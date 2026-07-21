import { alertRepository } from '../db/alertRepository';
import { AlertWithDetails, OpportunityRow } from '../types';
import { StructureAlert } from './structureAlertBuilder';

// In-memory queue for immediate structure alerts (LEG_ARMED only)
const pendingStructureAlerts: StructureAlert[] = [];
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

  // Structure alerts (LEG_ARMED) — immediate, bypass batch logic
  pushStructureAlert(alert: StructureAlert): void {
    pendingStructureAlerts.push(alert);
    console.log(`  AlertQueue: structure alert queued for ${alert.symbol}`);
  }

  getPendingStructureAlerts(): StructureAlert[] {
    return [...pendingStructureAlerts];
  }

  clearStructureAlerts(): void {
    pendingStructureAlerts.length = 0;
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
