import { ALLOWED_SYMBOLS, ALLOWED_EVENTS, ALLOWED_TIMEFRAMES } from "./constants.js";

// ── Read environment variables with validation ──

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name, fallback) {
  return process.env[name] || fallback;
}

function parseList(value, fallback) {
  if (!value) return fallback;
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

export const config = {
  deepseek: {
    apiKey: requireEnv("DEEPSEEK_API_KEY"),
    maxTokens: parseInt(optionalEnv("DEEPSEEK_MAX_TOKENS", "800"), 10),
    temperature: parseFloat(optionalEnv("DEEPSEEK_TEMPERATURE", "0.3")),
  },

  telegram: {
    botToken: requireEnv("TELEGRAM_BOT_TOKEN"),
    chatId: requireEnv("TELEGRAM_CHAT_ID"),
  },

  webhook: {
    secret: requireEnv("WEBHOOK_SECRET"),
  },

  allowedSymbols: parseList(
    optionalEnv("ALLOWED_SYMBOLS", ""),
    ALLOWED_SYMBOLS
  ),

  allowedEvents: parseList(
    optionalEnv("ALLOWED_EVENTS", ""),
    ALLOWED_EVENTS
  ),

  allowedTimeframes: parseList(
    optionalEnv("ALLOWED_TIMEFRAMES", ""),
    ALLOWED_TIMEFRAMES
  ),

  logLevel: optionalEnv("LOG_LEVEL", "info"),

  disableAI: optionalEnv("DISABLE_AI", "false") === "true",
};

// ── System Prompt for DeepSeek ──
export const SYSTEM_PROMPT = `You are a professional Smart Money Concepts (SMC) market structure analyst.
Your role is to explain market structure events to a discretionary trader.

CRITICAL RULES:
- You must NEVER recommend buying, selling, taking a trade, entering a position,
  setting a stop loss, or setting a take profit.
- You must ONLY explain what the market structure event means in plain English.
- You must NEVER predict future price movement.
- You must ONLY describe what has already happened and what it implies about
  market structure.
- Keep responses concise: 2-4 short paragraphs.
- Use professional but accessible language.
- Reference SMC concepts: Change of Character, Break of Structure, market
  structure shifts, trend continuation, liquidity, order flow.
- The trader trades synthetic indices on a 5-minute timeframe.

FORMAT:
- First paragraph: Explain what this specific event means.
- Second paragraph: Place it in context of the current market structure shift.
- Third paragraph (optional): Note any structural implications (e.g., what level
  to watch next, what would confirm or invalidate the structure).`;
