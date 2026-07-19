import { config } from './config/env';
import { initializeDatabase } from './db/schema';
import { symbolRepository } from './db/symbolRepository';
import { eventRepository } from './db/eventRepository';
import { marketStateRepository } from './db/marketStateRepository';
import { DerivClient } from './api/derivClient';
import { CandleManager } from './engine/candleManager';
import { ConfirmationLayer } from './engine/confirmationLayer';
import { OpportunityEngine } from './engine/opportunityEngine';
import { AlertQueue } from './notification/alertQueue';
import { NotificationEngine } from './notification/notificationEngine';
import { startServer } from './server/app';
import { BreakoutEvent } from './types';

console.log('============================================');
console.log('🚀 Market Structure Engine v3 Starting...');
console.log(`Tracking ${config.symbols.length} Symbols: ${config.symbols.join(', ')}`);
console.log(`Timeframe: ${config.timeframe}s | Engine: True SMC Structure Engine`);
console.log(`Notifications: every ${config.notificationCheckSeconds}s`);
console.log('============================================');

// ── Initialize database ──
initializeDatabase();

// ── Shared Alert Queue ──
const alertQueue = new AlertQueue();

// ── System 1: Notification Engine ──
const notificationEngine = new NotificationEngine(alertQueue);
notificationEngine.start();

// ── System 2: Opportunity Engine ──
const opportunityEngine = new OpportunityEngine();

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

  // Enqueue alert for notification ONLY IF it's a BOS event
  if (event.event.includes('BOS')) {
    alertQueue.enqueue(eventRow.id);
    console.log(`  📬 Alert queued (pending: ${alertQueue.count()})`);
  } else {
    console.log(`  ⏭ Event is CHoCH. Suppressed from notification queue.`);
  }

  // ── System 2: Evaluate active opportunities for this symbol ──
  opportunityEngine.onEvent(event).catch(err =>
    console.error('  ⚠️ OpportunityEngine event error:', err.message)
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
  
  // Feed candle to OpportunityEngine
  opportunityEngine.onCandle(symbol, candle).catch(err =>
    console.error('  ⚠️ OpportunityEngine candle error:', err.message)
  );
});

derivClient.connect();

// ── Dashboard Server ──
startServer();

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
