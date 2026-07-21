import { Candle, SwingPoint } from '../types';

/**
 * Checks whether the candle at `checkIndex` in `candles` is a confirmed
 * swing high or swing low, given pivotLen candles on each side.
 * Returns null if there isn't enough history yet, or if it isn't a pivot.
 *
 * Call this once per new candle close, with checkIndex = candles.length - 1 - pivotLen.
 */
export function detectNewPivot(
  candles: Candle[],
  pivotLen: number
): SwingPoint | null {
  const checkIndex = candles.length - 1 - pivotLen;
  if (checkIndex < pivotLen) return null; // not enough left-side history

  const pivotCandle = candles[checkIndex];
  const windowStart = checkIndex - pivotLen;
  const windowEnd = checkIndex + pivotLen;
  if (windowEnd >= candles.length) return null; // not enough right-side history yet

  let isHigh = true;
  let isLow = true;

  for (let i = windowStart; i <= windowEnd; i++) {
    if (i === checkIndex) continue;
    if (candles[i].high >= pivotCandle.high) isHigh = false;
    if (candles[i].low <= pivotCandle.low) isLow = false;
    if (!isHigh && !isLow) break;
  }

  if (isHigh) {
    return { index: checkIndex, time: pivotCandle.time, price: pivotCandle.high, type: 'high' };
  }
  if (isLow) {
    return { index: checkIndex, time: pivotCandle.time, price: pivotCandle.low, type: 'low' };
  }
  return null;
}
