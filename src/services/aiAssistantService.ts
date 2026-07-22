/**
 * AiAssistantService — System 2's conversational brain.
 *
 * Uses DeepSeek with tool calling to:
 * - Answer questions about the current market state
 * - Explain recent events and alerts in the context of the user's strategy
 * - Create and list personal watch tasks from natural conversation
 */

import { config } from '../config/env';
import { marketStateRepository } from '../db/marketStateRepository';
import { eventRepository } from '../db/eventRepository';
import { symbolRepository } from '../db/symbolRepository';
import { profileRepository } from '../db/profileRepository';
import { opportunityRepository } from '../db/opportunityRepository';

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

const SYSTEM_PROMPT = `You are an AI Trading Assistant — the personal analyst of the user.

You do NOT scan the market yourself. You read objective data produced by the Market Structure Engine (System 1), which monitors all instruments using Smart Money Concepts (SMC).

TIMEFRAME RULE: Never state or infer which timeframe an event happened on. If a tool result includes a timeframe field, read it directly. If it does not, say "timeframe not provided by the engine" rather than assuming it matches whatever the user mentioned earlier. Do not label events as "15m" or any other timeframe unless the tool result explicitly includes that field.

CRITICAL ENGINE GUARANTEE: Every BOS and CHoCH event you receive has already been validated by the engine as a CONFIRMED EXTERNAL STRUCTURAL BREAK. The engine uses body-close confirmation (not wicks) and strict higher-high / lower-low classification to filter out all internal noise and sub-structure. You must NEVER speculate about whether a reported BOS is "internal" or "external" — by the time you see it, it is already confirmed external structure.

CRITICAL DATA RULES — NEVER VIOLATE THESE:
1. NEVER state a price, trend, BOS level, or CHoCH level from memory or conversation history.
2. ALWAYS call get_market_state or get_recent_events FIRST before answering any question about market data.
3. If the user says your data is wrong, immediately call the tools again — do NOT guess a correction.
4. The live context injected at the top of this prompt is the ground truth. Use it. Do not contradict it.
5. If a tool returns no data, say so honestly — do not fill in numbers.

Your responsibilities:
1. Answer questions about market structure using the live data tools.
2. Explain why a specific event occurred in the context of the user's strategy.
3. Check the Opportunity Watchlist to see if the market is setting up for a trade.
4. Be concise, analytical, and use professional SMC terminology (BOS, CHoCH, swing high/low, impulse, correction, displacement, etc.).
5. NEVER give buy/sell entry recommendations.
6. ALWAYS end trading-related responses with: "The final trading decision belongs entirely to you."

### Opportunity Priority Rule
If the user asks:
* "What opportunities do I have?"
* "Show my setups."
* "Any trades?"
* "What should I look at?"
The AI MUST query the Opportunity Engine (using get_opportunities).
It must NOT generate opportunities from CHOCH or BOS records.
If there are active opportunities, they are the authoritative source.
Only if there are zero active opportunities should the AI optionally say:
"There are no active opportunities at the moment. The most recent structural events are..." and then discuss CHOCH/BOS.`;

// Tool definitions for DeepSeek
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_market_state',
      description: 'Get the current trend and last structural event for all monitored instruments.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_events',
      description: 'Get the most recent structural events (BOS/CHoCH) detected by the Engine.',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Optional. Filter by ticker symbol e.g. R_75' },
          limit: { type: 'number', description: 'Max events to return. Default 10.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_opportunities',
      description: 'Get the current Opportunity Watchlist automatically managed by the Opportunity Engine. Shows all active setups across all instruments.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

// Tool execution
function executeTool(name: string, args: any): string {
  switch (name) {
    case 'get_market_state': {
      const states = marketStateRepository.getAll();
      if (states.length === 0) return 'No market state data available yet.';
      return states.map(s =>
        `${s.ticker}: Trend=${s.trend}, LastBOS=${s.lastBos ?? 'N/A'}, LastCHoCH=${s.lastChoch ?? 'N/A'}`
      ).join('\n');
    }

    case 'get_recent_events': {
      const limit = args.limit ?? 10;
      const events = eventRepository.getRecent(limit);
      if (events.length === 0) return 'No recent events found.';
      return events.map((e: any) =>
        `[${new Date(e.created_at).toISOString()}] ${e.ticker} — ${e.direction} ${e.event_type} @ ${e.price} (Pivot: ${e.pivot_level})`
      ).join('\n');
    }

    case 'get_opportunities': {
      const opps = opportunityRepository.getAllActive();
      if (opps.length === 0) return 'There are currently no active opportunities on the watchlist.';
      
      return opps.map(o => {
        let details = `[${o.ticker}] ${o.direction} ${o.type} | Status: ${o.status}`;
        if (o.entry_price) {
          details += `\n  - Entry Zone (50%): ${o.entry_price.toFixed(4)}`;
          details += `\n  - Stop Loss (0%): ${o.impulse_start_price?.toFixed(4)}`;
          details += `\n  - Take Profit (100%): ${o.impulse_end_price?.toFixed(4)}`;
        }
        return details;
      }).join('\n\n');
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
}

export class AiAssistantService {
  /**
   * Process a user message and return the AI response.
   * history: the conversation so far (excluding system prompt)
   */
  static async chat(userMessage: string, history: ChatMessage[] = []): Promise<string> {
    const tradingProfile = profileRepository.get();

    // ── Pre-fetch live market data and inject as ground truth ────────────────
    // This ensures the AI ALWAYS has current data in context regardless of
    // whether it decides to call tools. Eliminates hallucinated prices.
    const liveMarketState = executeTool('get_market_state', {});
    const liveOpportunities = executeTool('get_opportunities', {});
    const hasActiveOpportunities = !liveOpportunities.includes('no active opportunities');

    // Only inject raw events if there are NO active opportunities.
    // When active opportunities exist, we deliberately hide raw events so the
    // AI cannot use them as a source for generating setups.
    const liveRecentEvents = hasActiveOpportunities
      ? null
      : executeTool('get_recent_events', { limit: 15 });

    const liveDataBlock = hasActiveOpportunities
      ? `
== LIVE ENGINE DATA (Ground Truth — injected at ${new Date().toISOString()}) ==

Current Market State:
${liveMarketState}

ACTIVE OPPORTUNITY WATCHLIST — THIS IS YOUR ONLY SOURCE FOR TRADING SETUPS:
${liveOpportunities}

== END LIVE DATA ==
STRICT RULE: Active opportunities are listed above. You MUST answer ALL setup/opportunity questions EXCLUSIVELY from this list.
Do NOT mention any other instrument that is not in this list as a trading opportunity.
Do NOT reference BOS or CHoCH events as opportunities. Only the Opportunity Watchlist is authoritative.`
      : `
== LIVE ENGINE DATA (Ground Truth — injected at ${new Date().toISOString()}) ==

Current Market State:
${liveMarketState}

Active Opportunities (Opportunity Watchlist):
There are currently no active opportunities. The engine is scanning the market.

Most Recent Structural Events (newest first):
${liveRecentEvents}

== END LIVE DATA ==
IMPORTANT: There are no active opportunities right now. You may discuss recent structural events for educational context only, but make clear that no setups have been confirmed by the Opportunity Engine.`;

    let dynamicSystemPrompt = `${SYSTEM_PROMPT}

${liveDataBlock}

USER'S TRADING PROFILE (Apply these rules to all analysis):\n${tradingProfile}`;
    if (history.length === 0) {
      dynamicSystemPrompt += `\n\nCRITICAL INSTRUCTION: Since this is a new conversation, begin your response exactly with: "Trading Profile loaded successfully. I'll analyze the market using your saved methodology."`;
    }

    const messages: any[] = [
      { 
        role: 'system', 
        content: dynamicSystemPrompt 
      },
      ...history,
      { role: 'user', content: userMessage },
    ];

    // Agentic loop: keep calling DeepSeek until it stops requesting tool calls
    for (let round = 0; round < 5; round++) {
      const body = {
        model: config.deepseekModel,
        temperature: 0.3,
        max_tokens: 800,
        messages,
        tools: TOOLS,
        tool_choice: 'auto',
      };

      const response = await fetch(DEEPSEEK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.deepseekApiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error(`AI Assistant DeepSeek error (${response.status}): ${errText.substring(0, 200)}`);
        return '⚠️ I encountered an error connecting to the AI service. Please try again.';
      }

      const data = await response.json() as any;
      const choice = data.choices?.[0];

      if (!choice) return '⚠️ No response from AI.';

      const assistantMessage = choice.message;
      messages.push(assistantMessage);

      // If the model wants to call tools, execute them and loop back
      if (choice.finish_reason === 'tool_calls' && assistantMessage.tool_calls) {
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
          console.log(`🧠 [AI Assistant] Tool call: ${toolName}(${JSON.stringify(toolArgs)})`);
          const toolResult = executeTool(toolName, toolArgs);

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolName,
            content: toolResult,
          });
        }
        // Continue the loop so DeepSeek can reason over the tool results
        continue;
      }

      // Model has finished — return the final text response
      return assistantMessage.content?.trim() || '⚠️ AI returned no content.';
    }

    return '⚠️ AI took too many reasoning steps. Please rephrase your question.';
  }
}
