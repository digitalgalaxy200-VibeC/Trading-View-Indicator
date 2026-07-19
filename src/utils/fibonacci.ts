export interface FibLevels {
  fib0: number;    // 0% — origin of impulse
  fib50: number;   // 50% — entry zone
  fib100: number;  // 100% — completion / target
}

/**
 * Calculate Fibonacci levels from an impulse leg.
 * The impulse is always measured from the origin to the extreme.
 *
 * For a bullish impulse: low → high (price pushed up)
 *   fib0  = low   (origin)
 *   fib50 = low + (high - low) * 0.5
 *   fib100 = high  (target)
 *
 * For a bearish impulse: high → low (price pushed down)
 *   fib0  = high  (origin)
 *   fib50 = high - (high - low) * 0.5
 *   fib100 = low   (target)
 */
export function calculateFibLevels(
  impulseHigh: number,
  impulseLow: number,
  direction: 'BULLISH' | 'BEARISH'
): FibLevels {
  const range = impulseHigh - impulseLow;

  if (direction === 'BULLISH') {
    return {
      fib0: impulseLow,
      fib50: impulseLow + range * 0.5,
      fib100: impulseHigh,
    };
  } else {
    return {
      fib0: impulseHigh,
      fib50: impulseHigh - range * 0.5,
      fib100: impulseLow,
    };
  }
}

/**
 * Check whether current price has reached (or crossed) the 50% retracement.
 * For bullish: price must retrace DOWN to fib50.
 * For bearish: price must retrace UP to fib50.
 */
export function isRetracementReached(
  currentPrice: number,
  fibLevels: FibLevels,
  direction: 'BULLISH' | 'BEARISH'
): boolean {
  if (direction === 'BULLISH') {
    // Price retraced down to 50% from the high
    return currentPrice <= fibLevels.fib50;
  } else {
    // Price retraced up to 50% from the low
    return currentPrice >= fibLevels.fib50;
  }
}

/**
 * Calculate risk-to-reward ratio based on entry, stop loss, and take profit.
 */
export function calculateRR(
  entry: number,
  stopLoss: number,
  takeProfit: number
): number {
  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(takeProfit - entry);
  if (risk === 0) return 0;
  return Math.round((reward / risk) * 100) / 100;
}
