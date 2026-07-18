import db from './connection';
import { NotificationConfigRow } from '../types';

export const configRepository = {
  get(): NotificationConfigRow {
    return db.prepare('SELECT * FROM notification_config WHERE id = 1').get() as NotificationConfigRow;
  },

  update(partial: Partial<NotificationConfigRow>): void {
    const fields: string[] = [];
    const values: any[] = [];

    const allowed = [
      'batch_window_minutes', 'min_alerts_to_send', 'max_batch_size',
      'cooldown_minutes', 'quiet_hours_start', 'quiet_hours_end', 'enabled'
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

    db.prepare(`UPDATE notification_config SET ${fields.join(', ')} WHERE id = 1`).run(...values);
  },
};
