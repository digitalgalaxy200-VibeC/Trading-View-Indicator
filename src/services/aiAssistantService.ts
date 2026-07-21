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

const SYSTEM_PROMPT = `You are a raw, highly intelligent SMC (Smart Money Concepts) Trading Analyst. You are not a rigid bot—you are a deep-thinking, analytical AI powered by DeepSeek. 

The user trades a specific strategy on 11 pairs (typically Volatility Indices) using Break of Structure (BOS) and Change of Character (CHoCH) to determine trend continuation. 

You have access to live tools to read the market state and recent structural events. 

Your goals:
1. Act as an intelligent analyst. Understand BOS, CHoCH, trends, and SMC deeply.
2. Read the live data provided via tools or injected context and give the user proper, unrestricted analysis.
3. If the user asks you to compare pairs, tell them which are in clear trends, which have broken structure, and give your own intelligent advice on what to look at.
4. You are free to synthesize information across tools to answer random, open-ended questions intelligently. Do not just recite data—analyze it.
5. NEVER give financial advice to buy or sell, but you CAN advise on which pairs present the best technical setups based on the SMC data. Always remind the user that the final decision is theirs.`;

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
        let details = `[${o.ticker}] ${o.direction} ${o.workflow_type} | Status: ${o.status}`;
        if (o.entry_price) {
          details += `\n  - Entry Zone (50%): ${o.entry_price.toFixed(4)}`;
          details += `\n  - Stop Loss (0%): ${o.impulse_low?.toFixed(4)}`;
          details += `\n  - Take Profit (100%): ${o.impulse_high?.toFixed(4)}`;
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

    // Inject the raw events and market states so the AI can analyze freely
    const liveRecentEvents = executeTool('get_recent_events', { limit: 20 });

    const liveDataBlock = `
== LIVE ENGINE DATA (Ground Truth — injected at ${new Date().toISOString()}) ==

Current Market State (All 11 Pairs):
${liveMarketState}

Opportunity Watchlist:
${liveOpportunities}

Most Recent Structural Events:
${liveRecentEvents}

== END LIVE DATA ==
Use this data to answer the user's analytical questions freely and intelligently. You are not restricted; you can advise, compare, and analyze as a top-tier SMC trader.`;

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
