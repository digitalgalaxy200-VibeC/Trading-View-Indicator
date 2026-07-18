import { alertRepository } from '../db/alertRepository';
import { AlertWithDetails } from '../types';

export class AlertQueue {
  enqueue(eventId: number): void {
    // Skip if a pending alert already exists for this event
    if (alertRepository.isDuplicate(eventId)) {
      console.log(`  AlertQueue: duplicate suppressed for event ${eventId}`);
      return;
    }
    alertRepository.insert(eventId);
  }

  getPending(): AlertWithDetails[] {
    return alertRepository.getPending();
  }

  markSent(alertIds: number[], emailId: number): void {
    alertRepository.markSent(alertIds, emailId);
  }

  count(): number {
    return alertRepository.count();
  }

  oldestPendingAge(): number | null {
    return alertRepository.oldestPendingAge();
  }
}
