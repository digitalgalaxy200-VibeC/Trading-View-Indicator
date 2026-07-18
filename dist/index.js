"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("./config/env");
const derivClient_1 = require("./api/derivClient");
const candleManager_1 = require("./engine/candleManager");
const confirmationLayer_1 = require("./engine/confirmationLayer");
const deepseekClient_1 = require("./api/deepseekClient");
const notificationService_1 = require("./services/notificationService");
console.log('============================================');
console.log('🚀 Multi-Symbol Market Structure Engine Starting...');
console.log(`Tracking ${env_1.config.symbols.length} Symbols: ${env_1.config.symbols.join(', ')}`);
console.log(`Timeframe: ${env_1.config.timeframe}s`);
console.log(`Pivot Lookback: ${env_1.config.pivotLength} bars`);
console.log('============================================');
const derivClient = new derivClient_1.DerivClient();
// The event handler is invoked by CandleManager when a newly closed candle causes a BOS/CHOCH.
// The ConfirmationLayer then decides whether this event is significant enough to notify.
const onEventDetected = async (symbol, confirmationLayer, event) => {
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
    const aiAnalysis = await deepseekClient_1.DeepSeekClient.analyzeEvent(symbol, event);
    console.log(`[${symbol}] AI Analysis complete.`);
    // 2. Send Notification
    await notificationService_1.NotificationService.sendAlert(symbol, event, aiAnalysis);
    console.log(`[${symbol}] ✅ Event processing complete.\n`);
};
// Maintain a dedicated CandleManager AND ConfirmationLayer for each symbol
const managers = new Map();
for (const symbol of env_1.config.symbols) {
    const confirmationLayer = new confirmationLayer_1.ConfirmationLayer();
    managers.set(symbol, new candleManager_1.CandleManager((event) => onEventDetected(symbol, confirmationLayer, event)));
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
