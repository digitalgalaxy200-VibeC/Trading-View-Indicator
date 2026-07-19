import db from './connection';
import { OpportunityRow } from '../types';

export const opportunityRepository = {
  create(opp: Omit<OpportunityRow, 'id' | 'created_at' | 'updated_at' | 'notified_at'>): OpportunityRow {
    const stmt = db.prepare(`
      INSERT INTO opportunities
        (symbol_id, direction, workflow_type, watch_level, status,
         choch_event_id, bos_event_id, impulse_high, impulse_low,
         fib_0, fib_50, fib_100, entry_price, stop_loss, take_profit, risk_reward)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      opp.symbol_id, opp.direction, opp.workflow_type, opp.watch_level, opp.status,
      opp.choch_event_id || null, opp.bos_event_id || null,
      opp.impulse_high || null, opp.impulse_low || null,
      opp.fib_0 || null, opp.fib_50 || null, opp.fib_100 || null,
      opp.entry_price || null, opp.stop_loss || null, opp.take_profit || null,
      opp.risk_reward || null
    );
    return db.prepare('SELECT * FROM opportunities WHERE id = ?').get(result.lastInsertRowid) as OpportunityRow;
  },

  update(id: number, partial: Partial<OpportunityRow>): void {
    const fields: string[] = [];
    const values: any[] = [];
    const allowed = [
      'watch_level', 'status', 'choch_event_id', 'bos_event_id',
      'impulse_high', 'impulse_low', 'fib_0', 'fib_50', 'fib_100',
      'entry_price', 'stop_loss', 'take_profit', 'risk_reward', 'notified_at'
    ];
    for (const key of allowed) {
      if ((partial as any)[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push((partial as any)[key]);
      }
    }
    if (fields.length === 0) return;
    fields.push('updated_at = ?');
    values.push(Date.now());
    db.prepare(`UPDATE opportunities SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
  },

  getActive(symbolId: number, direction?: string): OpportunityRow[] {
    let query = `
      SELECT o.*, s.ticker FROM opportunities o
      JOIN symbols s ON o.symbol_id = s.id
      WHERE o.symbol_id = ? AND o.status = 'active'
    `;
    if (direction) query += ' AND o.direction = ?';
    query += ' ORDER BY o.created_at DESC';
    return db.prepare(query).all(symbolId, ...(direction ? [direction] : [])) as OpportunityRow[];
  },

  getByWatchLevel(level: number): (OpportunityRow & { ticker: string })[] {
    return db.prepare(`
      SELECT o.*, s.ticker FROM opportunities o
      JOIN symbols s ON o.symbol_id = s.id
      WHERE o.watch_level = ? AND o.status = 'active'
      ORDER BY o.created_at DESC
    `).all(level) as (OpportunityRow & { ticker: string })[];
  },

  getAllActive(): (OpportunityRow & { ticker: string })[] {
    return db.prepare(`
      SELECT o.*, s.ticker FROM opportunities o
      JOIN symbols s ON o.symbol_id = s.id
      WHERE o.status = 'active'
      ORDER BY o.watch_level DESC, o.created_at DESC
    `).all() as (OpportunityRow & { ticker: string })[];
  },

  expireInactive(symbolId: number, currentTrend: string): void {
    // Expire opportunities whose direction no longer matches the trend
    // and that haven't been notified yet
    db.prepare(`
      UPDATE opportunities
      SET status = 'expired', updated_at = ?
      WHERE symbol_id = ? AND status = 'active'
        AND direction != ? AND notified_at IS NULL
    `).run(Date.now(), symbolId, currentTrend);
  },
};
