import { Candle } from '../types';
import { SwingDetector } from './swingDetector';
import { BreakoutDetector } from './breakoutDetector';
import { config } from '../config/env';

export class CandleManager {
  private candles: Candle[] = [];
  private swingDetector: SwingDetector;
  private breakoutDetector: BreakoutDetector;

  // Track the ID of the last event we fired to avoid duplicates
  private lastFiredEventId: string | null = null;

  // Gate: prevents historical initialization from firing live notifications
  private isInitializing: boolean = true;

  constructor(
    private readonly onEventDetected: (event: any) => void
  ) {
    this.swingDetector = new SwingDetector();
    this.breakoutDetector = new BreakoutDetector();
  }

  /**
   * Called once when the initial history is loaded via WebSocket.
   * Runs silently — no notifications are dispatched during this phase.
   */
  public initializeHistory(history: Candle[]) {
    this.isInitializing = true;

    // Store the last 300 candles to give the algorithm a solid context window
    this.candles = history.slice(-300);

    console.log(`[Engine] Replaying ${this.candles.length} historical candles to build state (silent)...`);

    // Replay all candles to reconstruct the current market structure state.
    // No events are fired during this loop.
    for (let i = config.pivotLength; i < this.candles.length; i++) {
      this.evaluateCandleClosure(i);
    }

    // History replay complete — switch to live mode
    this.isInitializing = false;

    console.log(`[Engine] ✅ Initial state built. Now watching for LIVE events.`);
    console.log(`  Current Trend:     ${this.breakoutDetector.getCurrentTrend()}`);
    console.log(`  Active Swing High: ${this.swingDetector.getActiveSwingHigh()}`);
    console.log(`  Active Swing Low:  ${this.swingDetector.getActiveSwingLow()}`);
  }

  /**
   * Called every time a new live candle officially closes.
   */
  public onNewCandleClosed(candle: Candle) {
    console.log(`[Engine] New candle closed: Epoch ${candle.epoch} | Close: ${candle.close}`);

    // Push it to the buffer
    this.candles.push(candle);

    // Keep buffer size manageable to prevent memory leaks
    if (this.candles.length > 500) {
      this.candles.shift();
    }

    // Evaluate this latest closure (isInitializing is false, so events fire normally)
    this.evaluateCandleClosure(this.candles.length - 1);
  }

  /**
   * The core evaluation loop for a specific closed candle index.
   */
  private evaluateCandleClosure(currentIndex: number) {
    // 1. Give the SwingDetector the opportunity to confirm a pivot
    this.swingDetector.evaluatePivots(this.candles, currentIndex);

    // 2. Give the BreakoutDetector the opportunity to check if the CURRENT candle broke an active pivot
    const activeHigh = this.swingDetector.getActiveSwingHigh();
    const activeLow = this.swingDetector.getActiveSwingLow();
    const currentCandle = this.candles[currentIndex];

    if (!currentCandle) {
      return;
    }

    const event = this.breakoutDetector.evaluateBreakouts(
      currentCandle,
      activeHigh,
      activeLow
    );

    // 3. Dispatch event only if:
    //    a) An event was detected
    //    b) It's not a duplicate of the last event
    //    c) We are NOT in the silent historical initialization phase
    if (event && event.id !== this.lastFiredEventId && !this.isInitializing) {
      this.lastFiredEventId = event.id;
      this.onEventDetected(event);
    }
  }
}
