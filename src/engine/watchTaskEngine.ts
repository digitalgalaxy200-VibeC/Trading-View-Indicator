/**
 * WatchTaskEngine — System 2's continuous evaluation loop.
 *
 * Responsibilities:
 * - On every breakout event from the Market Structure Engine, evaluate
 *   all active watch tasks for the affected symbol.
 * - If a task's condition is met → mark as 'triggered' + send AI Watch Email.
 * - If the market invalidates a setup (e.g. opposing CHOCH) → auto-invalidate.
 * - Periodically expire stale tasks (once per hour).
 *
 * This service listens passively to events emitted from the Engine's
 * onEventDetected callback — it never touches market data directly.
 */

import { watchTaskRepository, WatchTask } from '../db/watchTaskRepository';
import { sendWatchEmail } from '../notification/emailDispatcher';
import { BreakoutEvent } from '../types';

export class WatchTaskEngine {
  private expireTimer: NodeJS.Timeout | null = null;

  start(): void {
    console.log('🧠 [WatchTaskEngine] Started — monitoring active watch tasks.');

    // Expire stale tasks every hour
    this.expireTimer = setInterval(() => {
      const expired = watchTaskRepository.expireOld();
      if (expired > 0) {
        console.log(`🧠 [WatchTaskEngine] Expired ${expired} stale watch task(s).`);
      }
    }, 60 * 60 * 1000);
  }

  stop(): void {
    if (this.expireTimer) clearInterval(this.expireTimer);
  }

  /**
   * Called by index.ts every time the Market Structure Engine detects a new event.
   * Evaluates all active watch tasks for the given symbol.
   */
  async onEvent(event: BreakoutEvent): Promise<void> {
    const tasks = watchTaskRepository.getActive().filter(t => t.ticker === event.symbol);
    if (tasks.length === 0) return;

    console.log(`🧠 [WatchTaskEngine] Evaluating ${tasks.length} watch task(s) for ${event.symbol}...`);

    for (const task of tasks) {
      await this.evaluateTask(task, event);
    }
  }

  private async evaluateTask(task: WatchTask, event: BreakoutEvent): Promise<void> {
    const condLower = task.condition.toLowerCase();
    const eventType = event.event.toUpperCase();
    const direction = event.direction.toUpperCase();

    // --- Rule 1: Invalidation ---
    // If a watch is waiting for a bullish continuation but a bearish CHOCH appears → invalid.
    if (
      condLower.includes('bullish') &&
      eventType.includes('CHOCH') &&
      direction === 'BEARISH'
    ) {
      watchTaskRepository.updateStatus(
        task.id,
        'invalidated',
        `A Bearish CHoCH formed on ${task.ticker} before your condition was met.`,
        'low'
      );
      console.log(`🧠 [WatchTaskEngine] Watch #${task.id} invalidated — opposing structure formed.`);

      await sendWatchEmail({
        ticker: task.ticker,
        condition: task.condition,
        status: 'invalidated',
        reason: `The setup has been invalidated. A Bearish Change of Character (CHoCH) formed on ${task.ticker}, signalling a structural break against your anticipated direction. This watch has been automatically closed.`,
      });
      return;
    }

    if (
      condLower.includes('bearish') &&
      eventType.includes('CHOCH') &&
      direction === 'BULLISH'
    ) {
      watchTaskRepository.updateStatus(
        task.id,
        'invalidated',
        `A Bullish CHoCH formed on ${task.ticker} before your condition was met.`,
        'low'
      );
      console.log(`🧠 [WatchTaskEngine] Watch #${task.id} invalidated — opposing structure formed.`);

      await sendWatchEmail({
        ticker: task.ticker,
        condition: task.condition,
        status: 'invalidated',
        reason: `The setup has been invalidated. A Bullish Change of Character (CHoCH) formed on ${task.ticker}, signalling a structural break against your anticipated direction. This watch has been automatically closed.`,
      });
      return;
    }

    // --- Rule 2: BOS Continuation Trigger ---
    // If the user is watching for a continuation BOS in a specific direction
    if (
      condLower.includes('continuation') &&
      eventType.includes('BOS')
    ) {
      const wantsBullish = condLower.includes('bullish');
      const wantsBearish = condLower.includes('bearish');
      const triggered =
        (wantsBullish && direction === 'BULLISH') ||
        (wantsBearish && direction === 'BEARISH') ||
        (!wantsBullish && !wantsBearish); // direction-agnostic watch

      if (triggered) {
        watchTaskRepository.updateStatus(task.id, 'triggered', 'Continuation BOS confirmed.', 'high');
        console.log(`🧠 [WatchTaskEngine] Watch #${task.id} TRIGGERED — continuation BOS detected.`);

        await sendWatchEmail({
          ticker: task.ticker,
          condition: task.condition,
          status: 'triggered',
          reason: `A confirmed ${direction.toLowerCase()} continuation BOS has been detected on ${task.ticker}. The market structure has aligned with your watch condition. Please review the chart for your entry.`,
        });
        return;
      }
    }

    // --- Rule 3: CHoCH Alignment Trigger ---
    // If the user is watching for a CHOCH or trend reversal
    if (condLower.includes('choch') || condLower.includes('reversal')) {
      const wantsBullish = condLower.includes('bullish');
      const wantsBearish = condLower.includes('bearish');
      const triggered =
        (wantsBullish && eventType.includes('CHOCH') && direction === 'BULLISH') ||
        (wantsBearish && eventType.includes('CHOCH') && direction === 'BEARISH') ||
        (!wantsBullish && !wantsBearish && eventType.includes('CHOCH'));

      if (triggered) {
        watchTaskRepository.updateStatus(task.id, 'triggered', 'CHoCH structure confirmed.', 'high');
        console.log(`🧠 [WatchTaskEngine] Watch #${task.id} TRIGGERED — CHoCH detected.`);

        await sendWatchEmail({
          ticker: task.ticker,
          condition: task.condition,
          status: 'triggered',
          reason: `A ${direction.toLowerCase()} Change of Character (CHoCH) has been confirmed on ${task.ticker}. This signals a potential trend reversal matching your watch condition.`,
        });
      }
    }

    // --- Rule 4: Progress Update ---
    // If none of the above triggered, update the progress message to reflect latest activity.
    watchTaskRepository.updateProgress(
      task.id,
      `Last event on ${task.ticker}: ${direction} ${eventType} @ ${event.price.toFixed(2)}. Still watching for your condition.`,
      'medium'
    );
  }
}
