import db from './connection';

export interface Opportunity {
  id: number;
  symbol_id: number;
  ticker: string; // Joined from symbols
  type: 'REVERSAL' | 'CONTINUATION';
  status: 'LEVEL_1' | 'LEVEL_2' | 'TRIGGERED' | 'INVALIDATED' | 'CLOSED';
  direction: 'BULLISH' | 'BEARISH';
  impulse_start_price: number | null;
  impulse_end_price: number | null;
  entry_price: number | null;
  score: number | null;
  score_breakdown: string | null;
  detected_at: number;
  updated_at: number;
}

class OpportunityRepository {
  insert(
    symbolId: number,
    type: 'REVERSAL' | 'CONTINUATION',
    direction: 'BULLISH' | 'BEARISH',
    status: 'LEVEL_1' | 'LEVEL_2',
    impulseStartPrice?: number
  ): Opportunity {
    const stmt = db.prepare(`
      INSERT INTO opportunities (symbol_id, type, direction, status, impulse_start_price, detected_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const now = Date.now();
    const info = stmt.run(symbolId, type, direction, status, impulseStartPrice || null, now, now);
    return this.getById(info.lastInsertRowid as number)!;
  }

  getById(id: number): Opportunity | null {
    const stmt = db.prepare(`
      SELECT o.*, s.ticker
      FROM opportunities o
      JOIN symbols s ON o.symbol_id = s.id
      WHERE o.id = ?
    `);
    return (stmt.get(id) as Opportunity) || null;
  }

  getActiveBySymbol(symbolId: number): Opportunity[] {
    const stmt = db.prepare(`
      SELECT o.*, s.ticker
      FROM opportunities o
      JOIN symbols s ON o.symbol_id = s.id
      WHERE o.symbol_id = ? AND o.status IN ('LEVEL_1', 'LEVEL_2')
    `);
    return stmt.all(symbolId) as Opportunity[];
  }

  getAllActive(): Opportunity[] {
    const stmt = db.prepare(`
      SELECT o.*, s.ticker
      FROM opportunities o
      JOIN symbols s ON o.symbol_id = s.id
      WHERE o.status IN ('LEVEL_1', 'LEVEL_2', 'TRIGGERED')
      ORDER BY o.updated_at DESC
    `);
    return stmt.all() as Opportunity[];
  }

  updateLevel2(
    id: number,
    impulseEndPrice: number,
    entryPrice: number
  ): void {
    const stmt = db.prepare(`
      UPDATE opportunities
      SET impulse_end_price = ?, entry_price = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(impulseEndPrice, entryPrice, Date.now(), id);
  }

  updateStatus(
    id: number,
    status: 'LEVEL_1' | 'LEVEL_2' | 'TRIGGERED' | 'INVALIDATED' | 'CLOSED',
    score?: number,
    scoreBreakdown?: string
  ): void {
    let query = `UPDATE opportunities SET status = ?, updated_at = ?`;
    const params: any[] = [status, Date.now()];

    if (score !== undefined) {
      query += `, score = ?, score_breakdown = ?`;
      params.push(score, scoreBreakdown);
    }
    
    query += ` WHERE id = ?`;
    params.push(id);

    db.prepare(query).run(...params);
  }

  invalidateOpposing(symbolId: number, newDirection: 'BULLISH' | 'BEARISH'): void {
    const opposing = newDirection === 'BULLISH' ? 'BEARISH' : 'BULLISH';
    const stmt = db.prepare(`
      UPDATE opportunities
      SET status = 'INVALIDATED', updated_at = ?
      WHERE symbol_id = ? AND direction = ? AND status IN ('LEVEL_1', 'LEVEL_2')
    `);
    stmt.run(Date.now(), symbolId, opposing);
  }
}

export const opportunityRepository = new OpportunityRepository();
