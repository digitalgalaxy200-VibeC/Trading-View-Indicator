import { BreakoutEvent } from '../types';

/**
 * ConfirmationLayer filters out insignificant breakouts.
 * Currently passes all events through — extend with custom logic.
 */
export class ConfirmationLayer {
  private eventCount = 0;

  shouldNotify(event: BreakoutEvent): boolean {
    this.eventCount++;

    // Pass through all events for now
    // Future: add sequence confirmation (e.g., require CHOCH before BOS)
    return true;
  }

  getStateDescription(): string {
    return `Events processed: ${this.eventCount}`;
  }
}
