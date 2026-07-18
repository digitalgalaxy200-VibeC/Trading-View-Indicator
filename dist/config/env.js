"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function requireEnv(name) {
    const value = process.env[name];
    if (!value)
        throw new Error(`Missing required environment variable: ${name}`);
    return value;
}
function optionalEnv(name, fallback) {
    return process.env[name] || fallback;
}
exports.config = {
    // ── Deriv ──
    symbols: (optionalEnv('SYMBOLS', 'R_100,R_75,R_50,R_25,R_10,1HZ100V,1HZ75V,1HZ50V,BOOM1000,BOOM500,CRASH1000,CRASH500'))
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
    timeframe: parseInt(optionalEnv('TIMEFRAME', '60'), 10), // candle granularity in seconds
    pivotLength: parseInt(optionalEnv('PIVOT_LENGTH', '50'), 10),
    // ── DeepSeek ──
    deepseekApiKey: requireEnv('DEEPSEEK_API_KEY'),
    deepseekModel: optionalEnv('DEEPSEEK_MODEL', 'deepseek-chat'),
    deepseekMaxTokens: parseInt(optionalEnv('DEEPSEEK_MAX_TOKENS', '300'), 10),
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
