import { FibLevels, Leg } from '../types';

/**
 * 50% entry, 0% stop (leg origin), 100% target (leg extreme).
 * Always computes to exactly 1R by construction — the rr field is a
 * sanity check, not a variable to tune.
 */
export function computeFibLevels(leg: Leg): FibLevels {
  const { direction, originPrice, extremePrice } = leg;
  const range = Math.abs(extremePrice - originPrice);
  const entry =
    direction === 'bullish'
      ? originPrice + range * 0.5
      : originPrice - range * 0.5;

  const stop = originPrice;
  const target = extremePrice;

  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  const rr = risk > 0 ? reward / risk : 0;

  return { entry, stop, target, rr };
}
