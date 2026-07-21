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
for (const symbol of env_1.config.symbols) {
    // Use pivotLen from config
    managers.set(symbol, new candleManager_1.CandleManager(symbol, env_1.config.pivotLength));
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
    const res = manager.onNewCandleClosed(timeframe, candle);
    if (timeframe === '5m' && res) {
        // Process LTF continuation engine
        const htfBias = manager.getHtfState().bias;
        const ltfState = manager.getLtfState();
        const { actions: processActions } = (0, continuationEngine_1.processCandle)(ltfState, candle, res.event, htfBias);
        const fillActions = (0, continuationEngine_1.checkEntryFill)(ltfState, candle);
        const allActions = [...processActions, ...fillActions];
        for (const action of allActions) {
            if (action.kind === 'LEG_ARMED' || action.kind === 'TRADE_ENTERED') {
                const symbolId = symbolRepository_1.symbolRepository.getId(symbol);
                if (!symbolId)
                    continue;
                // Map to OpportunityRow so notification engine can consume it
                const opp = {
                    id: Date.now(), // ephemeral ID
                    symbol_id: symbolId,
                    direction: action.kind === 'LEG_ARMED' ? action.event.direction : action.trade.direction,
                    workflow_type: 'continuation',
                    watch_level: action.kind === 'LEG_ARMED' ? 2 : 3,
                    status: 'active',
                    choch_event_id: null,
                    bos_event_id: null,
                    impulse_high: action.kind === 'LEG_ARMED' ? action.event.leg.extremePrice : action.trade.target,
                    impulse_low: action.kind === 'LEG_ARMED' ? action.event.leg.originPrice : action.trade.stop,
                    fib_0: action.kind === 'LEG_ARMED' ? action.fib.stop : action.trade.stop,
                    fib_50: action.kind === 'LEG_ARMED' ? action.fib.entry : action.trade.entry,
                    fib_100: action.kind === 'LEG_ARMED' ? action.fib.target : action.trade.target,
                    entry_price: action.kind === 'LEG_ARMED' ? action.fib.entry : action.trade.entry,
                    stop_loss: action.kind === 'LEG_ARMED' ? action.fib.stop : action.trade.stop,
                    take_profit: action.kind === 'LEG_ARMED' ? action.fib.target : action.trade.target,
                    risk_reward: 1,
                    created_at: Date.now(),
                    updated_at: Date.now(),
                    notified_at: null,
                };
                alertQueue.enqueueOpportunity(opp);
            }
        }
        // Maintain backwards compatibility for market state / dashboard
        if (res.event) {
            const symbolId = symbolRepository_1.symbolRepository.getId(symbol);
            if (symbolId) {
                const isChoch = res.event.type === 'CHOCH';
                const trendAfter = res.event.direction.toUpperCase();
                marketStateRepository_1.marketStateRepository.upsert(symbolId, trendAfter, res.event.price, isChoch);
                // Insert event if it's BOS so dashboard sees it
                if (!isChoch) {
                    eventRepository_1.eventRepository.insert({
                        symbol: res.event.symbol,
                        event: res.event.direction === 'bullish' ? 'Bullish BOS' : 'Bearish BOS',
                        direction: res.event.direction.toUpperCase(),
                        price: res.event.price,
                        pivotLevel: res.event.leg.originPrice,
                        trendBefore: 'BULLISH', // Not used rigorously anymore
                        trendAfter: trendAfter,
                        candleEpoch: res.event.time / 1000
                    }, symbolId);
                }
            }
        }
    }
});
derivClient.connect();
(0, app_1.startServer)();
