import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Deriv Connection
  derivAppId: parseInt(process.env.DERIV_APP_ID || '1089', 10),
  derivWsUrl: process.env.DERIV_WS_URL || 'wss://ws.binaryws.com/websockets/v3',
  
  // Trading Settings
  symbol: process.env.SYMBOL || 'R_100',
  timeframe: parseInt(process.env.TIMEFRAME || '60', 10),
  pivotLength: parseInt(process.env.PIVOT_LENGTH || '50', 10),
  
  // External APIs
  deepseekApiKey: process.env.DEEPSEEK_API_KEY,
  resendApiKey: process.env.RESEND_API_KEY,
  
  // Notification Settings
  emailFrom: process.env.EMAIL_FROM,
  emailTo: process.env.EMAIL_TO,
};

// Validate required configurations
const missingKeys: string[] = [];

if (!config.deepseekApiKey) missingKeys.push('DEEPSEEK_API_KEY');
if (!config.resendApiKey) missingKeys.push('RESEND_API_KEY');
if (!config.emailFrom) missingKeys.push('EMAIL_FROM');
if (!config.emailTo) missingKeys.push('EMAIL_TO');

if (missingKeys.length > 0) {
  console.warn(`[WARNING] Missing environment variables: ${missingKeys.join(', ')}`);
  console.warn(`Please set these in your .env file before running in production.`);
}
