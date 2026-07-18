import { AlertQueue } from './alertQueue';
import { shouldSendBatch } from './batchDecider';
import { DeepSeekClient } from '../api/deepseekClient';
import { sendBatchEmail } from './emailDispatcher';
import { emailRepository } from '../db/emailRepository';
import { configRepository } from '../db/configRepository';
import { config } from '../config/env';

export class NotificationEngine {
  private queue: AlertQueue;
  private timer: NodeJS.Timeout | null = null;

  constructor(queue: AlertQueue) {
    this.queue = queue;
  }

  start(): void {
    console.log(`NotificationEngine started — checking every ${config.notificationCheckSeconds}s`);
    this.tick(); // run immediately on start
    this.timer = setInterval(() => this.tick(), config.notificationCheckSeconds * 1000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    try {
      const notifConfig = configRepository.get();
      const pending = this.queue.getPending();
      const pendingCount = pending.length;
      const oldestAge = this.queue.oldestPendingAge();
      const lastSent = emailRepository.getLastSentTime();
      const timeSinceLast = lastSent ? Date.now() - lastSent : null;

      const shouldSend = shouldSendBatch(pendingCount, oldestAge, timeSinceLast, notifConfig);

      if (!shouldSend) {
        if (pendingCount > 0) {
          console.log(`NotificationEngine: ${pendingCount} pending, waiting... (oldest: ${oldestAge ? Math.round(oldestAge / 1000) + 's' : 'N/A'})`);
        }
        return;
      }

      console.log(`\n📧 NotificationEngine: Sending batch of ${pendingCount} alerts...`);

      // Generate AI summary
      let aiSummary: string;
      try {
        aiSummary = await DeepSeekClient.summarizeBatch(pending);
        console.log(`  AI summary: ${aiSummary.length} chars`);
      } catch (err: any) {
        console.error('  AI summary failed:', err.message);
        aiSummary = '⚠️ AI summary unavailable — please review charts manually.';
      }

      // Send email
      const result = await sendBatchEmail(pending, aiSummary);

      // Record in database
      const emailRow = emailRepository.insert(
        pendingCount,
        aiSummary,
        result.resendId || null,
        result.success ? 'sent' : 'failed'
      );

      // Mark alerts as sent
      const alertIds = pending.map(a => a.id);
      this.queue.markSent(alertIds, emailRow.id);

      console.log(`  ✅ Batch complete: ${pendingCount} alerts → email #${emailRow.id}\n`);
    } catch (err: any) {
      console.error('NotificationEngine tick error:', err.message);
    }
  }
}
