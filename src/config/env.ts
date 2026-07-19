import dotenv from 'dotenv';
dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const config = {
  // ── Deriv ──
  symbols: (optionalEnv('SYMBOLS', 'R_75,R_50,R_25,R_10,1HZ75V,1HZ50V,1HZ25V,1HZ15V,1HZ10V,1HZ30V,1HZ100V'))
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  timeframe: 900,  // FORCE 15-minute candles (900 seconds)
  pivotLength: 20,  // 5 hours of 15m candles — filters internal noise

  // ── DeepSeek ──
  deepseekApiKey: optionalEnv('DEEPSEEK_API_KEY', ''),
  deepseekModel: optionalEnv('DEEPSEEK_MODEL', 'deepseek-chat'),
  deepseekMaxTokens: parseInt(optionalEnv('DEEPSEEK_MAX_TOKENS', '600'), 10),
  deepseekTemperature: parseFloat(optionalEnv('DEEPSEEK_TEMPERATURE', '0.3')),

  // ── Resend ──
  resendApiKey: requireEnv('RESEND_API_KEY'),
  notificationEmail: requireEnv('NOTIFICATION_EMAIL'),
  emailFrom: optionalEnv('EMAIL_FROM', 'AI Trend Assistant <alerts@yourdomain.com>'),

  // ── Notification ──
  batchWindowMinutes: parseInt(optionalEnv('BATCH_WINDOW_MINUTES', '5'), 10),
  minAlertsToSend: parseInt(optionalEnv('MIN_ALERTS_TO_SEND', '1'), 10),
  maxBatchSize: parseInt(optionalEnv('MAX_BATCH_SIZE', '10'), 10),
  cooldownMinutes: parseInt(optionalEnv('COOLDOWN_MINUTES', '2'), 10),
  notificationCheckSeconds: parseInt(optionalEnv('NOTIFICATION_CHECK_SECONDS', '60'), 10),

  // ── Server ──
  port: parseInt(optionalEnv('PORT', '3000'), 10),
  dashboardUrl: optionalEnv('DASHBOARD_URL', 'http://localhost:3000'),

  // ── Database ──
  dbPath: optionalEnv('DB_PATH', './data/assistant.db'),
};
