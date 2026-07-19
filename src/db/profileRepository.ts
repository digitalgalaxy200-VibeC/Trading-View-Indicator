import db from './connection';

export const profileRepository = {
  get(): string {
    const row = db.prepare('SELECT content FROM trading_profile WHERE id = 1').get() as { content: string } | undefined;
    return row?.content ?? 'No profile set.';
  },

  update(content: string): void {
    db.prepare('UPDATE trading_profile SET content = ?, updated_at = ? WHERE id = 1').run(content, Date.now());
  }
};
