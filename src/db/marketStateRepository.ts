import db from './connection';
import { MarketState } from '../types';
import { getTradingViewUrl } from '../utils/tradingViewUrl';

export const marketStateRepository = {
  upsert(symbolId: number, trend: string, price: number, isChoch: boolean): void {
    const now = Date.now();
    if (isChoch) {
      db.prepare(`
        INSERT INTO market_state (symbol_id, current_trend, last_choch_price, last_event_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(symbol_id) DO UPDATE SET
          current_trend = excluded.current_trend,
          last_choch_price = excluded.last_choch_price,
          last_event_at = excluded.last_event_at,
          updated_at = excluded.updated_at
      `).run(symbolId, trend, price, now, now);
    } else {
      db.prepare(`
        INSERT INTO market_state (symbol_id, current_trend, last_bos_price, last_event_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(symbol_id) DO UPDATE SET
          current_trend = excluded.current_trend,
          last_bos_price = excluded.last_bos_price,
          last_event_at = excluded.last_event_at,
          updated_at = excluded.updated_at
      `).run(symbolId, trend, price, now, now);
    }
  },

  getAll(): MarketState[] {
    return (db.prepare(`
      SELECT s.ticker, s.label, ms.current_trend as trend,
             ms.last_bos_price as lastBos, ms.last_choch_price as lastChoch,
             ms.last_event_at as lastEventAt
      FROM market_state ms
      JOIN symbols s ON ms.symbol_id = s.id
      WHERE s.active = 1
      ORDER BY s.ticker
    `).all() as any[]).map(row => ({
      ...row,
      chartUrl: getTradingViewUrl(row.ticker),
    }));
  },
};
