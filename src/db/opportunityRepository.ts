import db from './connection';

// ── Opportunity type (matches the DB schema) ────────────────────────────────
export interface Opportunity {
  id: number;
  symbol_id: number;
  ticker?: string; // joined from symbols
  direction: string;
  workflow_type: string;
  watch_level: number;
  status: string;
  choch_event_id: number | null;
  bos_event_id: number | null;
  impulse_high: number | null;
  impulse_low: number | null;
  fib_0: number | null;
  fib_50: number | null;
  fib_100: number | null;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  risk_reward: string | null;
  notified_at?: number | null;
  created_at?: number;
  updated_at?: number;
}

class OpportunityRepository {
  // ── Create a new opportunity ───────────────────────────────────────────────
  create(data: Partial<Opportunity>): Opportunity {
    const now = Date.now();
    const stmt = db.prepare(`
      INSERT INTO opportunities (
        symbol_id, direction, workflow_type, watch_level, status,
        choch_event_id, bos_event_id,
        impulse_high, impulse_low,
        fib_0, fib_50, fib_100,
        entry_price, stop_loss, take_profit, risk_reward,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?
      )
    `);
    const info = stmt.run(
      data.symbol_id ?? null,
      data.direction ?? null,
      data.workflow_type ?? null,
      data.watch_level ?? 1,
      data.status ?? 'active',
      data.choch_event_id ?? null,
      data.bos_event_id ?? null,
      data.impulse_high ?? null,
      data.impulse_low ?? null,
      data.fib_0 ?? null,
      data.fib_50 ?? null,
      data.fib_100 ?? null,
      data.entry_price ?? null,
      data.stop_loss ?? null,
      data.take_profit ?? null,
      data.risk_reward ?? null,
      now, now
    );
    return this.getById(info.lastInsertRowid as number)!;
  }

  // ── Update one or more fields on an opportunity ────────────────────────────
  update(id: number, fields: Partial<Opportunity>): void {
    const allowed = [
      'watch_level', 'status', 'bos_event_id',
      'impulse_high', 'impulse_low',
      'fib_0', 'fib_50', 'fib_100',
      'entry_price', 'stop_loss', 'take_profit', 'risk_reward',
      'notified_at',
    ];
    const keys = Object.keys(fields).filter(k => allowed.includes(k));
    if (keys.length === 0) return;

    const setClauses = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => (fields as any)[k]);
    db.prepare(`UPDATE opportunities SET ${setClauses}, updated_at = ? WHERE id = ?`)
      .run(...values, Date.now(), id);
  }

  // ── Get all active opportunities for a symbol (optionally by direction) ────
  getActive(symbolId: number, direction?: string): Opportunity[] {
    if (direction) {
      return db.prepare(`
        SELECT o.*, s.ticker FROM opportunities o
        JOIN symbols s ON o.symbol_id = s.id
        WHERE o.symbol_id = ? AND o.direction = ? AND o.status = 'active'
      `).all(symbolId, direction) as Opportunity[];
    }
    return db.prepare(`
      SELECT o.*, s.ticker FROM opportunities o
      JOIN symbols s ON o.symbol_id = s.id
      WHERE o.symbol_id = ? AND o.status = 'active'
    `).all(symbolId) as Opportunity[];
  }

  // ── Get all active opportunities across all symbols ────────────────────────
  getAllActive(): Opportunity[] {
    return db.prepare(`
      SELECT o.*, s.ticker FROM opportunities o
      JOIN symbols s ON o.symbol_id = s.id
      WHERE o.status IN ('active', 'notified')
      ORDER BY o.updated_at DESC
    `).all() as Opportunity[];
  }

  // ── Get all opportunities at a specific watch level ────────────────────────
  getByWatchLevel(level: number): Opportunity[] {
    return db.prepare(`
      SELECT o.*, s.ticker FROM opportunities o
      JOIN symbols s ON o.symbol_id = s.id
      WHERE o.watch_level = ? AND o.status = 'active'
    `).all(level) as Opportunity[];
  }

  // ── Expire/invalidate active opportunities in the opposing direction ────────
  expireInactive(symbolId: number, newTrend: string): void {
    const opposing = newTrend === 'BULLISH' ? 'BEARISH' : 'BULLISH';
    db.prepare(`
      UPDATE opportunities
      SET status = 'expired', updated_at = ?
      WHERE symbol_id = ? AND direction = ? AND status = 'active'
    `).run(Date.now(), symbolId, opposing);
  }

  // ── Lookup by id ──────────────────────────────────────────────────────────
  getById(id: number): Opportunity | null {
    return db.prepare(`
      SELECT o.*, s.ticker FROM opportunities o
      JOIN symbols s ON o.symbol_id = s.id
      WHERE o.id = ?
    `).get(id) as Opportunity | null;
  }
}

export const opportunityRepository = new OpportunityRepository();
