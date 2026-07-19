// ============================================================
// Config.gs — Configuration, Constants, and Settings
// AI Trend Assistant — Deriv Engine
// ============================================================

const CONFIG = {
  // ── Environment ──────────────────────────────────────────
  // The URL of your deployed Cloudflare Worker proxy
  CLOUDFLARE_WORKER_URL: 'https://your-worker-url-here.workers.dev', 
  
  // Your Google Sheet ID
  SHEET_ID: '', // ← Paste your Sheet ID here
  
  // Sheet Tab Names
  JOURNAL_SHEET_NAME: 'Trading Journal',
  STATE_SHEET_NAME: 'Engine State', // Hidden tab for state persistence

  // ── Trading Strategy Parameters ──────────────────────────
  SYMBOL: 'R_100', // Deriv Volatility 100 Index. Change to your preferred symbol (e.g., R_75, R_10)
  TIMEFRAME: 60,   // Timeframe in seconds. 60 = 1 minute (for testing). 900 = 15 minutes (production).
  PIVOT_LENGTH: 50, // Lookback period for confirming swing highs/lows (must match Pine Script)
  
  // ── DeepSeek Settings ────────────────────────────────────
  DEEPSEEK_API_URL: 'https://api.deepseek.com/chat/completions',
  DEEPSEEK_MODEL: 'deepseek-chat',
  MAX_TOKENS: 300,
  TEMPERATURE: 0.3,

  // ── Notification Settings ────────────────────────────────
  NOTIFICATION_EMAIL: 'your-email@example.com' // Where the alerts should be sent
};

// ── Google Sheets Column Mapping (Trading Journal) ─────────
const COLS = {
  DATE:         1,
  TIME:         2,
  SYMBOL:       3,
  TIMEFRAME:    4,
  EVENT:        5,
  DIRECTION:    6,
  PRICE:        7,
  AI_SUMMARY:   8
};
