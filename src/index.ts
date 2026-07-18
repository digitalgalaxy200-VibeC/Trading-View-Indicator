import { config } from './config/env';
import { DerivClient } from './api/derivClient';
import { CandleManager } from './engine/candleManager';
import { DeepSeekClient } from './api/deepseekClient';
import { NotificationService } from './services/notificationService';
import { BreakoutEvent } from './types';

console.log('============================================');
console.log('🚀 Market Structure Engine Starting...');
console.log(`Symbol: ${config.symbol}`);
console.log(`Timeframe: ${config.timeframe}s`);
console.log(`Pivot Lookback: ${config.pivotLength} bars`);
console.log('============================================');

const derivClient = new DerivClient();

// The event handler is invoked by CandleManager when a newly closed candle causes a BOS/CHOCH
const onEventDetected = async (event: BreakoutEvent) => {
  console.log(`\n🔔 EVENT DETECTED: ${event.direction} ${event.event} at ${event.price}`);
  console.log(`Pivot Broken: ${event.pivotLevel}`);

  // 1. Get AI Context
  const aiAnalysis = await DeepSeekClient.analyzeEvent(event);
  console.log('AI Analysis:', aiAnalysis);

  // 2. Send Notification
  await NotificationService.sendAlert(event, aiAnalysis);
  
  console.log('Event processing complete.\n');
};

const candleManager = new CandleManager(onEventDetected);

// Wire up the Deriv WebSocket streams to the CandleManager
derivClient.onHistory((historicalCandles) => {
  candleManager.initializeHistory(historicalCandles);
});

derivClient.onCandleClosed((closedCandle) => {
  candleManager.onNewCandleClosed(closedCandle);
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
