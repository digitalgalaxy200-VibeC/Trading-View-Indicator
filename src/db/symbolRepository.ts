import db from './connection';
import { SymbolRow } from '../types';

export const symbolRepository = {
  getId(ticker: string): number | null {
    const row = db.prepare('SELECT id FROM symbols WHERE ticker = ?').get(ticker) as SymbolRow | undefined;
    return row ? row.id : null;
  },

  getAll(): SymbolRow[] {
    return db.prepare('SELECT * FROM symbols WHERE active = 1 ORDER BY ticker').all() as SymbolRow[];
  },
};
