import { alertRepository } from '../db/alertRepository';
import { AlertWithDetails, OpportunityRow } from '../types';

// In-memory queue for L3 opportunities (not persisted to alerts table)
const pendingOpportunities: OpportunityRow[] = [];

export class AlertQueue {
  enqueue(eventId: number): void {
    if (alertRepository.isDuplicate(eventId)) {
      console.log(`  AlertQueue: duplicate suppressed for event ${eventId}`);
      return;
    }
    alertRepository.insert(eventId);
  }

  enqueueOpportunity(opp: OpportunityRow): void {
    pendingOpportunities.push(opp);
    console.log(`  AlertQueue: L3 opportunity queued (${pendingOpportunities.length} pending)`);
  }

  getPendingOpportunities(): OpportunityRow[] {
    return [...pendingOpportunities];
  }

  clearOpportunities(): void {
    pendingOpportunities.length = 0;
  }

  getPending(): AlertWithDetails[] {
    return alertRepository.getPending();
  }

  markSent(alertIds: number[], emailId: number): void {
    alertRepository.markSent(alertIds, emailId);
  }

  count(): number {
    return alertRepository.count() + pendingOpportunities.length;
  }

  oldestPendingAge(): number | null {
    return alertRepository.oldestPendingAge();
  }
}
