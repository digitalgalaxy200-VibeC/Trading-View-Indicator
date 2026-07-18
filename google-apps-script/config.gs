// ============================================================
// config.gs — Configuration, constants, and column mappings
// AI Trend Assistant V1
// ============================================================

// ── Project Configuration ────────────────────────────────────────────────────
// IMPORTANT: Set SHEET_ID to your Google Sheet ID before running.
// Find it in the Sheet URL: docs.google.com/spreadsheets/d/[SHEET_ID]/edit
const CONFIG = {
  SHEET_ID:           '',                         // ← Paste your Sheet ID here
  JOURNAL_SHEET_NAME: 'Trading Journal',
  LOGS_SHEET_NAME:    'Raw Logs',
  GMAIL_SEARCH_QUERY: 'from:noreply@tradingview.com is:unread',
  PROCESSED_LABEL:    'Processed by Script',
  DEEPSEEK_API_URL:   'https://api.deepseek.com/chat/completions',
  DEEPSEEK_MODEL:     'deepseek-chat',
  MAX_TOKENS:         300,
  TEMPERATURE:        0.3,
};

// ── Trading Journal Column Positions (1-based) ───────────────────────────────
const COLS = {
  DATE:         1,   // A — Date of alert
  TIME:         2,   // B — Time of alert
  SYMBOL:       3,   // C — e.g. VOLATILITY_75_INDEX
  TIMEFRAME:    4,   // D — e.g. 5m
  EVENT:        5,   // E — Bullish CHoCH / Bearish BOS
  DIRECTION:    6,   // F — BULLISH / BEARISH
  PRICE:        7,   // G — Price at signal
  AI_SUMMARY:   8,   // H — DeepSeek analysis
  CHART_LINK:   9,   // I — Clickable TradingView URL
  REVIEWED:     10,  // J — Yes / No (manual)
  TRADE_TAKEN:  11,  // K — Yes / No (manual)
  NOTES:        12,  // L — Free text (manual)
  STATUS:       13,  // M — System status (hidden)
  EMAIL_ID:     14,  // N — Gmail message ID (hidden, dedup)
};

// ── Raw Logs Column Positions (1-based) ──────────────────────────────────────
const LOG_COLS = {
  PROCESSED_AT:  1,  // A — When the script processed this
  EMAIL_SUBJECT: 2,  // B — Full email subject
  RAW_BODY:      3,  // C — Raw email body or JSON
  ERROR:         4,  // D — Error message
};

// ── Journal Headers ───────────────────────────────────────────────────────────
const JOURNAL_HEADERS = [
  'Date', 'Time', 'Symbol', 'Timeframe', 'Event', 'Direction',
  'Price', 'AI Summary', 'Chart Link', 'Reviewed', 'Trade Taken',
  'Notes', 'Status', 'Email ID',
];

// ── Logs Headers ──────────────────────────────────────────────────────────────
const LOGS_HEADERS = [
  'Processed At', 'Email Subject', 'Raw Body / JSON', 'Error',
];
