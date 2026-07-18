// ── Allowed Symbols (Volatility Indices watchlist) ──
export const ALLOWED_SYMBOLS = [
  "VOLATILITY_75_INDEX",
  "VOLATILITY_75_1S_INDEX",
  "VOLATILITY_50_INDEX",
  "VOLATILITY_30_1S_INDEX",
  "VOLATILITY_25_INDEX",
  "VOLATILITY_25_1S_INDEX",
  "VOLATILITY_15_1S_INDEX",
  "VOLATILITY_10_INDEX",
  "VOLATILITY_10_1S_INDEX",
  "VOLATILITY_100_1S_INDEX",
];

// ── Allowed Signal Events ──
export const ALLOWED_EVENTS = [
  "Bullish CHOCH",
  "Bearish CHOCH",
  "Bullish BOS",
  "Bearish BOS",
];

// ── Allowed Timeframes ──
export const ALLOWED_TIMEFRAMES = ["5"];

// ── Retry Configuration ──
export const MAX_RETRIES = 2;
export const RETRY_DELAY_MS = 1000;

// ── Telegram Limits ──
export const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;

// ── Safety Filter Patterns ──
export const SAFETY_FILTER_PATTERNS = [
  /\bbuy\b/gi,
  /\bsell\b/gi,
  /\blong\b/gi,
  /\bshort\b/gi,
  /\bentry\b/gi,
  /\bstop\s*loss\b/gi,
  /\btake\s*profit\b/gi,
  /\bTP\b/g,
  /\bSL\b/g,
  /\btarget\b/gi,
  /\bposition\b/gi,
];

// ── Event Emoji / Visual Mappings ──
export const EVENT_EMOJI = {
  "Bullish CHOCH": "\uD83D\uDD35", // Blue circle
  "Bearish CHOCH": "\uD83D\uDD34", // Red circle
  "Bullish BOS": "\uD83D\uDFE2", // Green circle
  "Bearish BOS": "\uD83D\uDFE0", // Orange circle
};
