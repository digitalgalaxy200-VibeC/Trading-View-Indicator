"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("./config/env");
const schema_1 = require("./db/schema");
const symbolRepository_1 = require("./db/symbolRepository");
const eventRepository_1 = require("./db/eventRepository");
const marketStateRepository_1 = require("./db/marketStateRepository");
const derivClient_1 = require("./api/derivClient");
const candleManager_1 = require("./engine/candleManager");
const continuationEngine_1 = require("./engine/continuationEngine");
const alertQueue_1 = require("./notification/alertQueue");
const notificationEngine_1 = require("./notification/notificationEngine");
const structureAlertBuilder_1 = require("./notification/structureAlertBuilder");
const deepseekClient_1 = require("./api/deepseekClient");
const app_1 = require("./server/app");
console.log('============================================');
console.log('🚀 Continuation Engine v5 Starting...');
console.log(`Tracking ${env_1.config.symbols.length} Symbols: ${env_1.config.symbols.join(', ')}`);
console.log('============================================');
(0, schema_1.initializeDatabase)();
const alertQueue = new alertQueue_1.AlertQueue();
const notificationEngine = new notificationEngine_1.NotificationEngine(alertQueue);
notificationEngine.start();
const derivClient = new derivClient_1.DerivClient();
const managers = new Map();
// Per-symbol 5m candle buffer — used to feed the commentary generator
const recentCandles5m = new Map();
for (const symbol of env_1.config.symbols) {
    managers.set(symbol, new candleManager_1.CandleManager(symbol, env_1.config.pivotLength));
    recentCandles5m.set(symbol, []);
}
// ── Log engine actions to DB (for dashboard/stats) ─────────────────────────
function logAction(symbol, action) {
    const symbolId = symbolRepository_1.symbolRepository.getId(symbol);
    if (!symbolId)
        return;
    const trendAfter = action.kind === 'CHOCH_WARNING' || action.kind === 'LEG_ARMED'
        ? action.event.direction.toUpperCase()
        : action.trade.direction.toUpperCase();
    const price = action.kind === 'CHOCH_WARNING' || action.kind === 'LEG_ARMED'
        ? action.event.price
        : action.trade.entry;
    const isChoch = action.kind === 'CHOCH_WARNING';
    marketStateRepository_1.marketStateRepository.upsert(symbolId, trendAfter, price, isChoch);
    // Save structural events (BOS/CHoCH) to events table for the dashboard
    if (action.kind === 'CHOCH_WARNING' || action.kind === 'LEG_ARMED') {
        eventRepository_1.eventRepository.insert({
            symbol,
            event: action.event.type === 'CHOCH'
                ? (action.event.direction === 'bullish' ? 'Bullish CHoCH' : 'Bearish CHoCH')
                : (action.event.direction === 'bullish' ? 'Bullish BOS' : 'Bearish BOS'),
            direction: trendAfter,
            price: action.event.price,
            pivotLevel: action.event.leg.originPrice,
            trendBefore: trendAfter === 'BULLISH' ? 'BEARISH' : 'BULLISH',
            trendAfter: trendAfter,
            candleEpoch: action.event.time / 1000,
        }, symbolId);
    }
}
derivClient.onHistory((symbol, timeframe, candles) => {
    const manager = managers.get(symbol);
    if (manager)
        manager.initializeHistory(timeframe, candles);
});
derivClient.onCandleClosed((symbol, timeframe, candle) => {
    const manager = managers.get(symbol);
    if (!manager)
        return;
    // Keep 5m buffer for commentary
    if (timeframe === '5m') {
        const buf = recentCandles5m.get(symbol) || [];
        buf.push(candle);
        if (buf.length > 50)
            buf.shift();
        recentCandles5m.set(symbol, buf);
    }
    const res = manager.onNewCandleClosed(timeframe, candle);
    if (!res)
        return;
    if (timeframe === '5m') {
        const htfBias = manager.getHtfState().bias;
        const ltfState = manager.getLtfState();
        const { actions: processActions } = (0, continuationEngine_1.processCandle)(ltfState, candle, res.event, htfBias);
        const fillActions = (0, continuationEngine_1.checkEntryFill)(ltfState, candle);
        for (const action of [...processActions, ...fillActions]) {
            // Log EVERY action to DB for the dashboard
            logAction(symbol, action);
            // Only LEG_ARMED triggers a notification email
            if (action.kind === 'LEG_ARMED') {
                const alert = (0, structureAlertBuilder_1.buildStructureAlert)(action.event, action.fib);
                const candles = recentCandles5m.get(symbol) || [];
                const chainCount = ltfState.trade?.chainCount ?? 1;
                // Fire commentary and alert in parallel — alert is never gated on AI
                (0, deepseekClient_1.generateSetupCommentary)(action.event, action.fib, candles, chainCount)
                    .then(commentary => {
                    // Attach commentary to the alert object for notificationEngine to pick up
                    alert.__commentary = commentary;
                    alertQueue.pushStructureAlert(alert);
                })
                    .catch(() => {
                    // AI failed — still send the alert immediately without commentary
                    alertQueue.pushStructureAlert(alert);
                });
            }
            // CHOCH_WARNING, TRADE_ENTERED, TARGET_HIT, STOP_HIT → DB only, no email
        }
    }
});
derivClient.connect();
(0, app_1.startServer)();
