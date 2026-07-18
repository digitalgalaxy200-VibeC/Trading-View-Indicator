import { NotificationConfigRow } from '../types';

export function isInQuietHours(config: NotificationConfigRow): boolean {
  if (!config.quiet_hours_start || !config.quiet_hours_end) return false;

  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const currentMinutes = utcHour * 60 + utcMinute;

  const [startH, startM] = config.quiet_hours_start.split(':').map(Number);
  const [endH, endM] = config.quiet_hours_end.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight range e.g. 22:00 to 06:00
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

export function formatTimestamp(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').substring(0, 19);
}

export function nowMs(): number {
  return Date.now();
}
