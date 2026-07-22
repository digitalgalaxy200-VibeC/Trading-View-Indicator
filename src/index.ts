import { config } from './config/env';
import { initializeDatabase } from './db/schema';
import { symbolRepository } from './db/symbolRepository';
import { eventRepository } from './db/eventRepository';
import { marketStateRepository } from './db/marketStateRepository';
import { DerivClient } from './api/derivClient';
import { CandleManager } from './engine/candleManager';
import { processCandle, checkEntryFill } from './engine/continuationEngine';
import { setManagers } from './engine/pipelineState';
import { AlertQueue } from './notification/alertQueue';
import { NotificationEngine } from './notification/notificationEngine';
import { buildStructureAlert } from './notification/structureAlertBuilder';
import { generateSetupCommentary } from './api/deepseekClient';
import { startServer } from './server/app';
import { Candle, EngineAction } from './types';

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

// Per-symbol 5m candle buffer — used to feed the commentary generator
const recentCandles5m = new Map<string, Candle[]>();

for (const symbol of config.symbols) {
  managers.set(symbol, new CandleManager(symbol, config.pivotLength));
  recentCandles5m.set(symbol, []);
}

// Expose to dashboard API
setManagers(managers);

// ── Log engine actions to DB (for dashboard/stats) ─────────────────────────
function logAction(symbol: string, action: EngineAction): void {
  const symbolId = symbolRepository.getId(symbol);
  if (!symbolId) return;

  const trendAfter = action.kind === 'CHOCH_WARNING' || action.kind === 'LEG_ARMED'
    ? action.event.direction.toUpperCase()
    : action.trade.direction.toUpperCase();

  const price = action.kind === 'CHOCH_WARNING' || action.kind === 'LEG_ARMED'
    ? action.event.price
    : action.trade.entry;

  const isChoch = action.kind === 'CHOCH_WARNING';

  marketStateRepository.upsert(symbolId, trendAfter, price, isChoch);

  // Save structural events (BOS/CHoCH) to events table for the dashboard
  if (action.kind === 'CHOCH_WARNING' || action.kind === 'LEG_ARMED') {
    eventRepository.insert({
      symbol,
      event: action.event.type === 'CHOCH'
        ? (action.event.direction === 'bullish' ? 'Bullish CHoCH' : 'Bearish CHoCH')
        : (action.event.direction === 'bullish' ? 'Bullish BOS' : 'Bearish BOS'),
      direction: trendAfter as any,
      price: action.event.price,
      pivotLevel: action.event.leg.originPrice,
      trendBefore: trendAfter === 'BULLISH' ? 'BEARISH' : 'BULLISH',
      trendAfter: trendAfter as any,
      candleEpoch: action.event.time / 1000,
    }, symbolId);
  }
}

derivClient.onHistory((symbol, timeframe, candles) => {
  const manager = managers.get(symbol);
  if (manager) manager.initializeHistory(timeframe, candles);
});

derivClient.onCandleClosed((symbol, timeframe, candle) => {
  const manager = managers.get(symbol);
  if (!manager) return;

  // Keep 5m buffer for commentary
  if (timeframe === '5m') {
    const buf = recentCandles5m.get(symbol) || [];
    buf.push(candle);
    if (buf.length > 50) buf.shift();
    recentCandles5m.set(symbol, buf);
  }

  const res = manager.onNewCandleClosed(timeframe, candle);
  if (!res) return;

  if (timeframe === '5m') {
    const htfBias = manager.getHtfState().bias;
    const ltfState = manager.getLtfState();

    const { actions: processActions } = processCandle(ltfState, candle, res.event, htfBias);
    const fillActions = checkEntryFill(ltfState, candle);

    for (const action of [...processActions, ...fillActions]) {
      // Log EVERY action to DB for the dashboard
      logAction(symbol, action);

      // Only LEG_ARMED triggers a notification email
      if (action.kind === 'LEG_ARMED') {
        const alert = buildStructureAlert(action.event, action.fib);
        const candles = recentCandles5m.get(symbol) || [];
        const chainCount = ltfState.trade?.chainCount ?? 1;

        // Fire commentary and alert in parallel — alert is never gated on AI
        generateSetupCommentary(action.event, action.fib, candles, chainCount)
          .then(commentary => {
            // Attach commentary to the alert object for notificationEngine to pick up
            (alert as any).__commentary = commentary;
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
startServer();
