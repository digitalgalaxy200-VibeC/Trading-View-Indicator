import db from './connection';
import { EventRow, BreakoutEvent } from '../types';

export const eventRepository = {
  insert(event: BreakoutEvent, symbolId: number): EventRow | null {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO events
        (symbol_id, event_type, direction, price, pivot_level, trend_before, trend_after, candle_epoch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      symbolId,
      event.event,
      event.direction,
      event.price,
      event.pivotLevel,
      event.trendBefore,
      event.trendAfter,
      event.candleEpoch
    );
    if (result.changes === 0) return null; // duplicate

    return db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid) as EventRow;
  },

  getBySymbol(symbolId: number, limit: number = 100): EventRow[] {
    return db.prepare(
      'SELECT * FROM events WHERE symbol_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(symbolId, limit) as EventRow[];
  },

  getRecent(limit: number = 200): EventRow[] {
    return db.prepare(
      'SELECT * FROM events ORDER BY created_at DESC LIMIT ?'
    ).all(limit) as EventRow[];
  },

  getRecentSince(sinceMs: number): EventRow[] {
    return db.prepare(
      'SELECT e.*, s.ticker FROM events e JOIN symbols s ON e.symbol_id = s.id WHERE e.created_at >= ? ORDER BY e.created_at DESC'
    ).all(sinceMs) as (EventRow & { ticker: string })[];
  },

  getStats(): { totalBos: number; totalChoch: number; bullish: number; bearish: number } {
    const row = db.prepare(`
      SELECT
        SUM(CASE WHEN event_type = 'BOS' THEN 1 ELSE 0 END) as totalBos,
        SUM(CASE WHEN event_type = 'CHOCH' THEN 1 ELSE 0 END) as totalChoch,
        SUM(CASE WHEN direction = 'BULLISH' THEN 1 ELSE 0 END) as bullish,
        SUM(CASE WHEN direction = 'BEARISH' THEN 1 ELSE 0 END) as bearish
      FROM events
    `).get() as any;
    return {
      totalBos: row.totalBos || 0,
      totalChoch: row.totalChoch || 0,
      bullish: row.bullish || 0,
      bearish: row.bearish || 0,
    };
  },
};
