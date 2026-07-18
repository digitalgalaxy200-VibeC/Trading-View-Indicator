import { config } from './config/env';
import { DerivClient } from './api/derivClient';
import { CandleManager } from './engine/candleManager';
import { ConfirmationLayer } from './engine/confirmationLayer';
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

// The event handler is invoked by CandleManager when a newly closed candle causes a BOS/CHOCH.
// The ConfirmationLayer then decides whether this event is significant enough to notify.
const onEventDetected = async (symbol: string, confirmationLayer: ConfirmationLayer, event: BreakoutEvent) => {
  console.log(`\n📊 [${symbol}] Detected: ${event.direction} ${event.event} @ ${event.price} (Pivot: ${event.pivotLevel})`);

  // Run through the confirmation filter
  const shouldNotify = confirmationLayer.shouldNotify(event);
  console.log(`[${symbol}] Confirmation state: ${confirmationLayer.getStateDescription()}`);

  if (!shouldNotify) {
    console.log(`[${symbol}] ⏸ Notification suppressed. Waiting for sequence confirmation.\n`);
    return;
  }

  console.log(`\n🔔 [${symbol}] CONFIRMED EVENT — sending notification.`);

  // 1. Get AI Context
  const aiAnalysis = await DeepSeekClient.analyzeEvent(symbol, event);
  console.log(`[${symbol}] AI Analysis complete.`);

  // 2. Send Notification
  await NotificationService.sendAlert(symbol, event, aiAnalysis);

  console.log(`[${symbol}] ✅ Event processing complete.\n`);
};

// Maintain a dedicated CandleManager AND ConfirmationLayer for each symbol
const managers = new Map<string, CandleManager>();

for (const symbol of config.symbols) {
  const confirmationLayer = new ConfirmationLayer();
  managers.set(symbol, new CandleManager((event) => onEventDetected(symbol, confirmationLayer, event)));
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
