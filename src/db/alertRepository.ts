import db from './connection';
import { AlertRow, AlertWithDetails } from '../types';

export const alertRepository = {
  insert(eventId: number): AlertRow {
    const stmt = db.prepare(
      'INSERT INTO alerts (event_id) VALUES (?)'
    );
    const result = stmt.run(eventId);
    return db.prepare('SELECT * FROM alerts WHERE id = ?').get(result.lastInsertRowid) as AlertRow;
  },

  isDuplicate(eventId: number): boolean {
    const row = db.prepare(
      'SELECT 1 FROM alerts WHERE event_id = ? AND status = \'pending\''
    ).get(eventId);
    return !!row;
  },

  getPending(): AlertWithDetails[] {
    return db.prepare(`
      SELECT a.*, s.ticker, e.event_type, e.direction, e.price,
             e.trend_before, e.trend_after, e.pivot_level, e.candle_epoch
      FROM alerts a
      JOIN events e ON a.event_id = e.id
      JOIN symbols s ON e.symbol_id = s.id
      WHERE a.status = 'pending'
      ORDER BY a.created_at ASC
    `).all() as AlertWithDetails[];
  },

  count(): number {
    const row = db.prepare(
      'SELECT COUNT(*) as cnt FROM alerts WHERE status = \'pending\''
    ).get() as any;
    return row.cnt || 0;
  },

  oldestPendingAge(): number | null {
    const row = db.prepare(
      'SELECT MIN(created_at) as oldest FROM alerts WHERE status = \'pending\''
    ).get() as any;
    if (!row.oldest) return null;
    return Date.now() - row.oldest;
  },

  markSent(alertIds: number[], emailId: number): void {
    const stmt = db.prepare(
      'UPDATE alerts SET status = \'sent\', email_id = ?, sent_at = ? WHERE id = ?'
    );
    const now = Date.now();
    const tx = db.transaction(() => {
      for (const id of alertIds) {
        stmt.run(emailId, now, id);
      }
    });
    tx();
  },

  getRecent(limit: number = 100): AlertWithDetails[] {
    return db.prepare(`
      SELECT a.*, s.ticker, e.event_type, e.direction, e.price,
             e.trend_before, e.trend_after, e.pivot_level, e.candle_epoch
      FROM alerts a
      JOIN events e ON a.event_id = e.id
      JOIN symbols s ON e.symbol_id = s.id
      ORDER BY a.created_at DESC
      LIMIT ?
    `).all(limit) as AlertWithDetails[];
  },

  getRecentSince(sinceMs: number): AlertWithDetails[] {
    return db.prepare(`
      SELECT a.*, s.ticker, e.event_type, e.direction, e.price,
             e.trend_before, e.trend_after, e.pivot_level, e.candle_epoch
      FROM alerts a
      JOIN events e ON a.event_id = e.id
      JOIN symbols s ON e.symbol_id = s.id
      WHERE a.created_at >= ?
      ORDER BY a.created_at DESC
    `).all(sinceMs) as AlertWithDetails[];
  },

  getById(id: number): AlertWithDetails | undefined {
    return db.prepare(`
      SELECT a.*, s.ticker, e.event_type, e.direction, e.price,
             e.trend_before, e.trend_after, e.pivot_level, e.candle_epoch
      FROM alerts a
      JOIN events e ON a.event_id = e.id
      JOIN symbols s ON e.symbol_id = s.id
      WHERE a.id = ?
    `).get(id) as AlertWithDetails | undefined;
  },

  getByEmailId(emailId: number): AlertWithDetails[] {
    return db.prepare(`
      SELECT a.*, s.ticker, e.event_type, e.direction, e.price,
             e.trend_before, e.trend_after, e.pivot_level, e.candle_epoch
      FROM alerts a
      JOIN events e ON a.event_id = e.id
      JOIN symbols s ON e.symbol_id = s.id
      WHERE a.email_id = ?
      ORDER BY a.created_at ASC
    `).all(emailId) as AlertWithDetails[];
  },

  getLatestTimestamp(): number | null {
    const row = db.prepare(
      'SELECT MAX(created_at) as latest FROM alerts'
    ).get() as any;
    return row?.latest ?? null;
  },
};
