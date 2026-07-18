import { NotificationConfigRow } from '../types';
import { isInQuietHours } from '../utils/timeUtils';

export function shouldSendBatch(
  pendingCount: number,
  oldestAgeMs: number | null,
  timeSinceLastEmailMs: number | null,
  config: NotificationConfigRow
): boolean {
  if (!config.enabled) return false;
  if (isInQuietHours(config)) return false;
  if (pendingCount === 0) return false;

  // Safety valve: force-send if too many accumulated
  if (pendingCount >= config.max_batch_size) return true;

  // Oldest alert has waited long enough
  if (oldestAgeMs !== null && oldestAgeMs >= config.batch_window_minutes * 60_000) return true;

  // Minimum threshold met and cooldown passed
  if (
    pendingCount >= config.min_alerts_to_send &&
    (timeSinceLastEmailMs === null || timeSinceLastEmailMs >= config.cooldown_minutes * 60_000)
  ) {
    return true;
  }

  return false;
}
