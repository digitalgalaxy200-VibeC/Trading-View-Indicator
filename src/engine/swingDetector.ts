import { Candle } from '../types';
import { config } from '../config/env';

export class SwingDetector {
  private activeSwingHigh: number | null = null;
  private activeSwingLow: number | null = null;

  /**
   * Evaluates if the candle at (currentIndex - PIVOT_LENGTH) is a confirmed pivot.
   * This logic matches exactly how TradingView confirms pivots based on a trailing window.
   */
  public evaluatePivots(candles: Candle[], currentIndex: number) {
    const pivotLen = config.pivotLength;

    if (currentIndex < pivotLen) {
      return; // Not enough history to confirm a pivot yet
    }

    const pivotIdx = currentIndex - pivotLen;
    const potentialPivot = candles[pivotIdx];
    
    if (!potentialPivot) {
      return;
    }
    
    // The window of candles that occurred *after* the potential pivot, up to the current index.
    const windowCandles = candles.slice(pivotIdx + 1, currentIndex + 1);
    
    let highestInWindow = -Infinity;
    let lowestInWindow = Infinity;
    
    for (const c of windowCandles) {
      if (c.high > highestInWindow) highestInWindow = c.high;
      if (c.low < lowestInWindow) lowestInWindow = c.low;
    }

    // Confirm Pivot High (Swing High)
    // If the potential pivot's high is strictly greater than all highs in the subsequent window
    if (potentialPivot.high > highestInWindow) {
      this.activeSwingHigh = potentialPivot.high;
    }

    // Confirm Pivot Low (Swing Low)
    // If the potential pivot's low is strictly less than all lows in the subsequent window
    if (potentialPivot.low < lowestInWindow) {
      this.activeSwingLow = potentialPivot.low;
    }
  }

  public getActiveSwingHigh(): number | null {
    return this.activeSwingHigh;
  }

  public getActiveSwingLow(): number | null {
    return this.activeSwingLow;
  }
}
