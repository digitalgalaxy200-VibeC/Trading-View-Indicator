"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    // Deriv Connection
    derivAppId: parseInt(process.env.DERIV_APP_ID || '1089', 10),
    derivWsUrl: process.env.DERIV_WS_URL || 'wss://ws.binaryws.com/websockets/v3',
    // Trading Settings
    symbols: (process.env.SYMBOLS || 'R_100').split(',').map(s => s.trim()),
    timeframe: parseInt(process.env.TIMEFRAME || '900', 10),
    pivotLength: parseInt(process.env.PIVOT_LENGTH || '50', 10),
    // External APIs
    deepseekApiKey: process.env.DEEPSEEK_API_KEY,
    resendApiKey: process.env.RESEND_API_KEY,
    // Notification Settings
    emailFrom: process.env.EMAIL_FROM,
    emailTo: process.env.EMAIL_TO,
};
// Validate required configurations
const missingKeys = [];
if (!exports.config.deepseekApiKey)
    missingKeys.push('DEEPSEEK_API_KEY');
if (!exports.config.resendApiKey)
    missingKeys.push('RESEND_API_KEY');
if (!exports.config.emailFrom)
    missingKeys.push('EMAIL_FROM');
if (!exports.config.emailTo)
    missingKeys.push('EMAIL_TO');
if (missingKeys.length > 0) {
    console.warn(`[WARNING] Missing environment variables: ${missingKeys.join(', ')}`);
    console.warn(`Please set these in your .env file before running in production.`);
}
