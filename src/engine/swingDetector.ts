import { Candle } from '../types';
import { config } from '../config/env';

export class SwingDetector {
  private activeSwingHigh: number | null = null;
  private activeSwingLow: number | null = null;

  /**
   * Faithfully replicates Pine Script's ta.pivothigh(pivotLen, pivotLen) and
   * ta.pivotlow(pivotLen, pivotLen) behavior.
   *
   * In Pine Script, ta.pivothigh(leftBars, rightBars) confirms a pivot high at
   * bar[rightBars] only when BOTH conditions are met:
   *   1. The candidate bar's high is strictly greater than all 'leftBars' bars before it.
   *   2. The candidate bar's high is strictly greater than all 'rightBars' bars after it.
   *
   * This means a pivot is confirmed 'pivotLen' bars AFTER it occurred.
   * At the moment currentIndex is being evaluated, the candidate pivot is at:
   *   pivotIdx = currentIndex - pivotLen
   *
   * We then verify it was also higher/lower than all 'pivotLen' bars that came
   * BEFORE it (leftBars), which are at indices [pivotIdx - pivotLen ... pivotIdx - 1].
   */
  public evaluatePivots(candles: Candle[], currentIndex: number) {
    const pivotLen = config.pivotLength;

    // We need at least (2 * pivotLen) candles from the start to have both sides
    if (currentIndex < 2 * pivotLen) {
      return;
    }

    // The candidate pivot is 'pivotLen' bars behind the current index (right-side confirmed)
    const pivotIdx = currentIndex - pivotLen;
    const candidate = candles[pivotIdx];

    if (!candidate) {
      return;
    }

    // --- Left window: the 'pivotLen' candles strictly before the candidate ---
    const leftStart = pivotIdx - pivotLen;
    const leftEnd   = pivotIdx;           // exclusive (not including the candidate itself)

    // --- Right window: the 'pivotLen' candles strictly after the candidate ---
    const rightStart = pivotIdx + 1;
    const rightEnd   = currentIndex + 1;  // inclusive of current

    let highestLeft  = -Infinity;
    let lowestLeft   =  Infinity;
    let highestRight = -Infinity;
    let lowestRight  =  Infinity;

    for (let i = leftStart; i < leftEnd; i++) {
      const c = candles[i];
      if (!c) continue;
      if (c.high > highestLeft) highestLeft = c.high;
      if (c.low  < lowestLeft)  lowestLeft  = c.low;
    }

    for (let i = rightStart; i < rightEnd; i++) {
      const c = candles[i];
      if (!c) continue;
      if (c.high > highestRight) highestRight = c.high;
      if (c.low  < lowestRight)  lowestRight  = c.low;
    }

    // Confirm Pivot High: candidate must be strictly highest on BOTH sides
    if (candidate.high > highestLeft && candidate.high > highestRight) {
      this.activeSwingHigh = candidate.high;
    }

    // Confirm Pivot Low: candidate must be strictly lowest on BOTH sides
    if (candidate.low < lowestLeft && candidate.low < lowestRight) {
      this.activeSwingLow = candidate.low;
    }
  }

  public getActiveSwingHigh(): number | null {
    return this.activeSwingHigh;
  }

  public getActiveSwingLow(): number | null {
    return this.activeSwingLow;
  }
}
