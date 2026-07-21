import { config } from './config/env';
import { initializeDatabase } from './db/schema';
import { symbolRepository } from './db/symbolRepository';
import { eventRepository } from './db/eventRepository';
import { marketStateRepository } from './db/marketStateRepository';
import { DerivClient } from './api/derivClient';
import { CandleManager } from './engine/candleManager';
import { processCandle, checkEntryFill } from './engine/continuationEngine';
import { AlertQueue } from './notification/alertQueue';
import { NotificationEngine } from './notification/notificationEngine';
import { startServer } from './server/app';
import { BreakoutEvent, OpportunityRow, EngineAction } from './types';

console.log('============================================');
console.log('🚀 Continuation Engine v5 Starting...');
console.log(`Tracking ${config.symbols.length} Symbols: ${config.symbols.join(', ')}`);
console.log('============================================');

initializeDatabase();

const alertQueue = new AlertQueue();
const notificationEngine = new NotificationEngine(alertQueue);
notificationEngine.start();

const derivClient = new DerivClient();
const managers = new Map<string, CandleManager>();

for (const symbol of config.symbols) {
  // Use pivotLen from config
  managers.set(symbol, new CandleManager(symbol, config.pivotLength));
}

derivClient.onHistory((symbol, timeframe, candles) => {
  const manager = managers.get(symbol);
  if (manager) manager.initializeHistory(timeframe, candles);
});

derivClient.onCandleClosed((symbol, timeframe, candle) => {
  const manager = managers.get(symbol);
  if (!manager) return;

  const res = manager.onNewCandleClosed(timeframe, candle);
  
  if (timeframe === '5m' && res) {
    // Process LTF continuation engine
    const htfBias = manager.getHtfState().bias;
    const ltfState = manager.getLtfState();
    
    const { actions: processActions } = processCandle(ltfState, candle, res.event, htfBias);
    const fillActions = checkEntryFill(ltfState, candle);
    
    const allActions = [...processActions, ...fillActions];
    
    for (const action of allActions) {
      if (action.kind === 'LEG_ARMED' || action.kind === 'TRADE_ENTERED') {
        const symbolId = symbolRepository.getId(symbol);
        if (!symbolId) continue;
        
        // Map to OpportunityRow so notification engine can consume it
        const opp: OpportunityRow = {
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
      const symbolId = symbolRepository.getId(symbol);
      if (symbolId) {
        const isChoch = res.event.type === 'CHOCH';
        const trendAfter = res.event.direction.toUpperCase();
        marketStateRepository.upsert(symbolId, trendAfter, res.event.price, isChoch);
        
        // Insert event if it's BOS so dashboard sees it
        if (!isChoch) {
          eventRepository.insert({
            symbol: res.event.symbol,
            event: res.event.direction === 'bullish' ? 'Bullish BOS' : 'Bearish BOS',
            direction: res.event.direction.toUpperCase() as any,
            price: res.event.price,
            pivotLevel: res.event.leg.originPrice,
            trendBefore: 'BULLISH', // Not used rigorously anymore
            trendAfter: trendAfter as any,
            candleEpoch: res.event.time / 1000
          }, symbolId);
        }
      }
    }
  }
});

derivClient.connect();
startServer();
