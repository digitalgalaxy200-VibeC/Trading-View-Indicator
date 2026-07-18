import { config } from './config/env';
import { DerivClient } from './api/derivClient';
import { CandleManager } from './engine/candleManager';
import { DeepSeekClient } from './api/deepseekClient';
import { NotificationService } from './services/notificationService';
import { BreakoutEvent } from './types';

console.log('============================================');
console.log('🚀 Multi-Symbol Market Structure Engine Starting...');
console.log(`Tracking ${config.symbols.length} Symbols: ${config.symbols.join(', ')}`);
console.log(`Timeframe: ${config.timeframe}s`);
console.log(`Pivot Lookback: ${config.pivotLength} bars`);
console.log('============================================');

const derivClient = new DerivClient();

// The event handler is invoked by CandleManager when a newly closed candle causes a BOS/CHOCH
const onEventDetected = async (symbol: string, event: BreakoutEvent) => {
  console.log(`\n🔔 [${symbol}] EVENT DETECTED: ${event.direction} ${event.event} at ${event.price}`);
  console.log(`Pivot Broken: ${event.pivotLevel}`);

  // 1. Get AI Context
  const aiAnalysis = await DeepSeekClient.analyzeEvent(symbol, event);
  console.log(`[${symbol}] AI Analysis:`, aiAnalysis);

  // 2. Send Notification
  await NotificationService.sendAlert(symbol, event, aiAnalysis);
  
  console.log(`[${symbol}] Event processing complete.\n`);
};

// Maintain a dedicated CandleManager for each symbol
const managers = new Map<string, CandleManager>();

for (const symbol of config.symbols) {
  managers.set(symbol, new CandleManager((event) => onEventDetected(symbol, event)));
}

// Wire up the Deriv WebSocket streams to the respective CandleManagers
derivClient.onHistory((symbol, historicalCandles) => {
  const manager = managers.get(symbol);
  if (manager) {
    manager.initializeHistory(historicalCandles);
  }
});

derivClient.onCandleClosed((symbol, closedCandle) => {
  const manager = managers.get(symbol);
  if (manager) {
    manager.onNewCandleClosed(closedCandle);
  }
});

// Start the WebSocket connection
derivClient.connect();

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\nGracefully shutting down engine...');
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('\nGracefully shutting down engine...');
  process.exit(0);
});
