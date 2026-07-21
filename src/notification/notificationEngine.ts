import { AlertQueue } from './alertQueue';
import { shouldSendBatch } from './batchDecider';
import { DeepSeekClient } from '../api/deepseekClient';
import { sendBatchEmail, sendOpportunityEmail } from './emailDispatcher';
import { emailRepository } from '../db/emailRepository';
import { configRepository } from '../db/configRepository';
import { opportunityRepository } from '../db/opportunityRepository';
import { config } from '../config/env';

export class NotificationEngine {
  private queue: AlertQueue;
  private timer: NodeJS.Timeout | null = null;

  constructor(queue: AlertQueue) {
    this.queue = queue;
  }

  start(): void {
    console.log(`NotificationEngine started — checking every ${config.notificationCheckSeconds}s`);
    this.tick();
    this.timer = setInterval(() => this.tick(), config.notificationCheckSeconds * 1000);
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private async tick(): Promise<void> {
    try {
      // ── V4: L3 Opportunities take priority — send immediately ──
      const l3Opps = this.queue.getPendingOpportunities();
      if (l3Opps.length > 0) {
        await this.sendL3Opportunities(l3Opps);
        this.queue.clearOpportunities();
      }

      // ── Regular event alerts (batched) ──
      const notifConfig = configRepository.get();
      const pending = this.queue.getPending();
      const pendingCount = pending.length;
      const oldestAge = this.queue.oldestPendingAge();
      const lastSent = emailRepository.getLastSentTime();
      const timeSinceLast = lastSent ? Date.now() - lastSent : null;

      if (!shouldSendBatch(pendingCount, oldestAge, timeSinceLast, notifConfig)) {
        return;
      }

      console.log(`\n📧 Sending batch of ${pendingCount} alerts...`);
      let aiSummary: string;
      try {
        aiSummary = await DeepSeekClient.summarizeBatch(pending);
      } catch (err: any) {
        aiSummary = '⚠️ AI summary unavailable.';
      }

      const result = await sendBatchEmail(pending, aiSummary);
      const emailRow = emailRepository.insert(pendingCount, aiSummary, result.resendId || null, result.success ? 'sent' : 'failed');
      const alertIds = pending.map(a => a.id);
      this.queue.markSent(alertIds, emailRow.id);
      console.log(`  ✅ ${pendingCount} alerts → email #${emailRow.id}\n`);
    } catch (err: any) {
      console.error('NotificationEngine error:', err.message);
    }
  }

  private async sendL3Opportunities(opps: any[]): Promise<void> {
    console.log(`\n🎯 Sending ${opps.length} L3 opportunity notification(s)...`);

    for (const opp of opps) {
      try {
        // Get AI score
        let scoreText = '';
        try {
          scoreText = await DeepSeekClient.scoreOpportunity(opp);
        } catch {
          scoreText = 'Score unavailable.';
        }

        const result = await sendOpportunityEmail(opp, scoreText);
        if (result.success) {
          opportunityRepository.update(opp.id, { status: 'notified' });
        }

        const emailRow = emailRepository.insert(1, scoreText, result.resendId || null, result.success ? 'sent' : 'failed');
        console.log(`  ✅ L3 ${opp.direction} ${opp.workflow_type} → email #${emailRow.id}`);
      } catch (err: any) {
        console.error(`  ❌ L3 email failed: ${err.message}`);
      }
    }
  }
}
