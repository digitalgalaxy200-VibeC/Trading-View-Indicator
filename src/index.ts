import { config } from './config/env';
import { initializeDatabase } from './db/schema';
import { symbolRepository } from './db/symbolRepository';
import { eventRepository } from './db/eventRepository';
import { marketStateRepository } from './db/marketStateRepository';
import { DerivClient } from './api/derivClient';
import { CandleManager } from './engine/candleManager';
import { ConfirmationLayer } from './engine/confirmationLayer';
import { WatchTaskEngine } from './engine/watchTaskEngine';
import { AlertQueue } from './notification/alertQueue';
import { NotificationEngine } from './notification/notificationEngine';
import { OpportunityEngine } from './opportunity/opportunityEngine';
import { startServer } from './server/app';
import { BreakoutEvent } from './types';

console.log('============================================');
console.log('🚀 Market Structure Engine v4 — Opportunity Engine Active');
console.log(`Tracking ${config.symbols.length} Symbols: ${config.symbols.join(', ')}`);
console.log(`Timeframe: ${config.timeframe}s | Pivot: ${config.pivotLength} bars`);
console.log('============================================');

// ── Initialize database ──
initializeDatabase();

// ── Shared Alert Queue ──
const alertQueue = new AlertQueue();

// ── Notification Engine ──
const notificationEngine = new NotificationEngine(alertQueue);
notificationEngine.start();

// ── Watch Task Engine ──
const watchTaskEngine = new WatchTaskEngine();
watchTaskEngine.start();

// ── V4: Opportunity Engine ──
const opportunityEngine = new OpportunityEngine();

// L3 callback — when an opportunity reaches trade-ready status
opportunityEngine.onLevel3(async (opp) => {
  const symbol = symbolRepository.getAll().find(s => s.id === opp.symbol_id);
  const ticker = symbol?.ticker || 'Unknown';
  console.log(`\n🎯 OPPORTUNITY L3: ${ticker} ${opp.direction} ${opp.workflow_type}`);
  console.log(`   Entry: ${opp.entry_price?.toFixed(2)} | SL: ${opp.stop_loss?.toFixed(2)} | TP: ${opp.take_profit?.toFixed(2)} | R:R ${opp.risk_reward}`);

  // Queue for notification — the NotificationEngine will handle batching + AI scoring
  alertQueue.enqueueOpportunity(opp);
});

// ── Deriv WebSocket Client ──
const derivClient = new DerivClient();

const onEventDetected = (symbol: string, rawEvent: Omit<BreakoutEvent, 'symbol'>) => {
  const event = { ...rawEvent, symbol } as BreakoutEvent;
  console.log(`\n📊 [${symbol}] ${event.direction} ${event.event} @ ${event.price} (Pivot: ${event.pivotLevel})`);

  const symbolId = symbolRepository.getId(symbol);
  if (!symbolId) {
    console.error(`  Unknown symbol: ${symbol}`);
    return;
  }

  // Save event to database
  const eventRow = eventRepository.insert(event, symbolId);
  if (!eventRow) {
    console.log(`  ⏭ Duplicate event suppressed.`);
    return;
  }
  console.log(`  ✅ Event saved (ID: ${eventRow.id})`);

  // Update market state
  const isChoch = event.event.toUpperCase().includes('CHOCH');
  marketStateRepository.upsert(symbolId, event.trendAfter, event.price, isChoch);

  // ── V4: Feed event to Opportunity Engine (manages L1→L2→L3 pipeline) ──
  opportunityEngine.handleEvent(symbol, event);

  // Evaluate watch tasks
  watchTaskEngine.onEvent(event).catch(err =>
    console.error('  ⚠️ WatchTaskEngine error:', err.message)
  );
};

// ── Create CandleManager per symbol ──
const managers = new Map<string, CandleManager>();

for (const symbol of config.symbols) {
  const manager = new CandleManager((event) => onEventDetected(symbol, event));
  managers.set(symbol, manager);
}

derivClient.onHistory((symbol, candles) => {
  const manager = managers.get(symbol);
  if (manager) manager.initializeHistory(candles);
});

derivClient.onCandleClosed((symbol, candle) => {
  const manager = managers.get(symbol);
  if (manager) manager.onNewCandleClosed(candle);

  // ── V4: Monitor retracement on every candle close ──
  opportunityEngine.monitorRetracement(symbol, candle.close);
});

derivClient.connect();

// ── Dashboard Server ──
startServer();

// ── Graceful shutdown ──
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  notificationEngine.stop();
  watchTaskEngine.stop();
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  notificationEngine.stop();
  watchTaskEngine.stop();
  process.exit(0);
});
