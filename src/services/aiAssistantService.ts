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
import { watchTaskRepository } from '../db/watchTaskRepository';
import { symbolRepository } from '../db/symbolRepository';
import { profileRepository } from '../db/profileRepository';

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

const SYSTEM_PROMPT = `You are an AI Trading Assistant — the personal analyst of the user.

You do NOT scan the market yourself. You read objective data produced by the Market Structure Engine (System 1), which monitors all instruments on a 15-minute timeframe using Smart Money Concepts (SMC).

CRITICAL ENGINE GUARANTEE: Every BOS and CHoCH event you receive has already been validated by the engine as a CONFIRMED EXTERNAL STRUCTURAL BREAK. The engine uses body-close confirmation (not wicks) and strict higher-high / lower-low classification to filter out all internal noise and sub-structure. You must NEVER speculate about whether a reported BOS is "internal" or "external" — by the time you see it, it is already confirmed external structure.

Your responsibilities:
1. Answer questions about market structure using the data tools available to you.
2. Explain why a specific event occurred in the context of the user's strategy.
3. Create watch tasks based on what the user asks you to monitor.
4. Be concise, analytical, and use professional SMC terminology (BOS, CHoCH, swing high/low, impulse, correction, displacement, etc.).
5. NEVER give buy/sell entry recommendations.
6. ALWAYS end trading-related responses with: "The final trading decision belongs entirely to you."
7. If you are uncertain about any data, call a tool to retrieve the current engine state rather than speculating.

When you create a watch task, confirm clearly with: "Watch created: [condition]"`;

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
      name: 'create_watch_task',
      description: 'Create a personal watch task that will monitor the market and notify the user when their condition is met.',
      parameters: {
        type: 'object',
        properties: {
          ticker: { type: 'string', description: 'Instrument ticker e.g. R_75, R_50, 1HZ75V' },
          condition: { type: 'string', description: 'The watch condition in plain English. E.g. "Notify me when a bearish continuation BOS occurs"' },
          priority: { type: 'string', enum: ['high', 'normal', 'low'], description: 'Alert priority. Default normal.' },
          timeframe: { type: 'string', description: 'Timeframe. Default 15m.' },
        },
        required: ['ticker', 'condition'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_watch_tasks',
      description: 'List the user\'s current active watch tasks.',
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

    case 'create_watch_task': {
      const { ticker, condition, priority = 'normal', timeframe = '15m' } = args;
      const symbolId = symbolRepository.getId(ticker);
      if (!symbolId) return `Unknown ticker: ${ticker}. Available: R_75, R_50, R_25, R_10, 1HZ75V, 1HZ50V, etc.`;
      const task = watchTaskRepository.insert(symbolId, condition, timeframe, priority as any);
      return `Watch task created successfully. ID: #${task.id} | Symbol: ${ticker} | Priority: ${priority} | Condition: "${condition}"`;
    }

    case 'list_watch_tasks': {
      const tasks = watchTaskRepository.getActive();
      if (tasks.length === 0) return 'You have no active watch tasks.';
      return tasks.map(t =>
        `#${t.id} [${t.priority.toUpperCase()}] ${t.ticker} — "${t.condition}" | Status: ${t.status} | Progress: ${t.progress_msg ?? 'Waiting...'}`
      ).join('\n');
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

    let dynamicSystemPrompt = `${SYSTEM_PROMPT}\n\nUSER'S TRADING PROFILE (Apply these rules to all analysis):\n${tradingProfile}`;
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
        temperature: 0.5,
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
