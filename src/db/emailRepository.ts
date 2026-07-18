import db from './connection';
import { EmailRow } from '../types';

export const emailRepository = {
  insert(alertCount: number, aiSummary: string, resendId: string | null, status: string): EmailRow {
    const stmt = db.prepare(
      'INSERT INTO emails (alert_count, ai_summary, status, resend_id) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(alertCount, aiSummary, status, resendId);
    return db.prepare('SELECT * FROM emails WHERE id = ?').get(result.lastInsertRowid) as EmailRow;
  },

  getLastSentTime(): number | null {
    const row = db.prepare(
      'SELECT MAX(sent_at) as lastSent FROM emails WHERE status = \'sent\''
    ).get() as any;
    return row.lastSent || null;
  },

  getRecent(limit: number = 50): EmailRow[] {
    return db.prepare(
      'SELECT * FROM emails ORDER BY sent_at DESC LIMIT ?'
    ).all(limit) as EmailRow[];
  },

  count(): number {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM emails').get() as any;
    return row.cnt || 0;
  },

  getById(id: number): EmailRow | undefined {
    return db.prepare('SELECT * FROM emails WHERE id = ?').get(id) as EmailRow | undefined;
  },
};

