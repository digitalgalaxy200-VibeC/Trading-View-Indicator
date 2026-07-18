"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("./config/env");
const schema_1 = require("./db/schema");
const symbolRepository_1 = require("./db/symbolRepository");
const eventRepository_1 = require("./db/eventRepository");
const marketStateRepository_1 = require("./db/marketStateRepository");
const derivClient_1 = require("./api/derivClient");
const candleManager_1 = require("./engine/candleManager");
const alertQueue_1 = require("./notification/alertQueue");
const notificationEngine_1 = require("./notification/notificationEngine");
const app_1 = require("./server/app");
console.log('============================================');
console.log('🚀 Market Structure Engine v2 Starting...');
console.log(`Tracking ${env_1.config.symbols.length} Symbols: ${env_1.config.symbols.join(', ')}`);
console.log(`Timeframe: ${env_1.config.timeframe}s | Pivot: ${env_1.config.pivotLength} bars`);
console.log(`Notifications: every ${env_1.config.notificationCheckSeconds}s`);
console.log('============================================');
// ── Initialize database ──
(0, schema_1.initializeDatabase)();
// ── Shared Alert Queue ──
const alertQueue = new alertQueue_1.AlertQueue();
// ── Notification Engine ──
const notificationEngine = new notificationEngine_1.NotificationEngine(alertQueue);
notificationEngine.start();
// ── Deriv WebSocket Client ──
const derivClient = new derivClient_1.DerivClient();
const onEventDetected = (symbol, rawEvent) => {
    const event = { ...rawEvent, symbol };
    console.log(`\n📊 [${symbol}] ${event.direction} ${event.event} @ ${event.price} (Pivot: ${event.pivotLevel})`);
    const symbolId = symbolRepository_1.symbolRepository.getId(symbol);
    if (!symbolId) {
        console.error(`  Unknown symbol: ${symbol}`);
        return;
    }
    // Save event to database
    const eventRow = eventRepository_1.eventRepository.insert(event, symbolId);
    if (!eventRow) {
        console.log(`  ⏭ Duplicate event suppressed.`);
        return;
    }
    console.log(`  ✅ Event saved (ID: ${eventRow.id})`);
    // Update market state
    const isChoch = event.event.toUpperCase().includes('CHOCH');
    marketStateRepository_1.marketStateRepository.upsert(symbolId, event.trendAfter, event.price, isChoch);
    // Enqueue alert for notification ONLY IF it's a BOS event
    if (event.event.includes('BOS')) {
        alertQueue.enqueue(eventRow.id);
        console.log(`  📬 Alert queued (pending: ${alertQueue.count()})`);
    }
    else {
        console.log(`  ⏭ Event is CHoCH. Suppressed from notification queue.`);
    }
};
// ── Create CandleManager per symbol ──
const managers = new Map();
for (const symbol of env_1.config.symbols) {
    const manager = new candleManager_1.CandleManager((event) => onEventDetected(symbol, event));
    managers.set(symbol, manager);
}
derivClient.onHistory((symbol, candles) => {
    const manager = managers.get(symbol);
    if (manager)
        manager.initializeHistory(candles);
});
derivClient.onCandleClosed((symbol, candle) => {
    const manager = managers.get(symbol);
    if (manager)
        manager.onNewCandleClosed(candle);
});
derivClient.connect();
// ── Dashboard Server ──
(0, app_1.startServer)();
// ── Graceful shutdown ──
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    notificationEngine.stop();
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('\nShutting down...');
    notificationEngine.stop();
    process.exit(0);
});
