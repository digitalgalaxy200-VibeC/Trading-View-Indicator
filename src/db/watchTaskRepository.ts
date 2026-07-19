import db from './connection';

export interface WatchTask {
  id: number;
  symbol_id: number;
  ticker: string;
  timeframe: string;
  condition: string;
  priority: 'high' | 'normal' | 'low';
  status: 'waiting' | 'triggered' | 'invalidated' | 'cancelled';
  progress_msg: string | null;
  confidence: string | null;
  created_by: string;
  created_at: number;
  updated_at: number;
  expires_at: number | null;
}

export const watchTaskRepository = {
  /** Return all currently active tasks with the ticker symbol joined in */
  getActive(): WatchTask[] {
    return db.prepare(`
      SELECT wt.*, s.ticker
      FROM watch_tasks wt
      JOIN symbols s ON wt.symbol_id = s.id
      WHERE wt.status = 'waiting'
      ORDER BY wt.priority DESC, wt.created_at ASC
    `).all() as WatchTask[];
  },

  getAll(limit = 50): WatchTask[] {
    return db.prepare(`
      SELECT wt.*, s.ticker
      FROM watch_tasks wt
      JOIN symbols s ON wt.symbol_id = s.id
      ORDER BY wt.created_at DESC
      LIMIT ?
    `).all(limit) as WatchTask[];
  },

  insert(symbolId: number, condition: string, timeframe = '15m', priority: 'high' | 'normal' | 'low' = 'normal'): WatchTask {
    const now = Date.now();
    const info = db.prepare(`
      INSERT INTO watch_tasks (symbol_id, timeframe, condition, priority, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'waiting', ?, ?)
    `).run(symbolId, timeframe, condition, priority, now, now);

    return db.prepare(`
      SELECT wt.*, s.ticker FROM watch_tasks wt
      JOIN symbols s ON wt.symbol_id = s.id
      WHERE wt.id = ?
    `).get(info.lastInsertRowid) as WatchTask;
  },

  updateStatus(id: number, status: WatchTask['status'], progressMsg?: string, confidence?: string): void {
    db.prepare(`
      UPDATE watch_tasks
      SET status = ?, progress_msg = ?, confidence = ?, updated_at = ?
      WHERE id = ?
    `).run(status, progressMsg ?? null, confidence ?? null, Date.now(), id);
  },

  updateProgress(id: number, progressMsg: string, confidence?: string): void {
    db.prepare(`
      UPDATE watch_tasks
      SET progress_msg = ?, confidence = ?, updated_at = ?
      WHERE id = ?
    `).run(progressMsg, confidence ?? null, Date.now(), id);
  },

  expireOld(): number {
    const now = Date.now();
    const info = db.prepare(`
      UPDATE watch_tasks
      SET status = 'invalidated', progress_msg = 'Expired: no trigger within allotted time.', updated_at = ?
      WHERE status = 'waiting' AND expires_at IS NOT NULL AND expires_at < ?
    `).run(now, now);
    return info.changes;
  },
};
