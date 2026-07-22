import { Candle } from '../types';

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  SMC Structure Engine — Phase 7 Rewrite
 *  ──────────────────────────────────────────────────────────────────────
 *
 *  Replaces the generic fractal-pivot algorithm with a true SMC pipeline
 *  that distinguishes EXTERNAL (swing) structure from INTERNAL (sub)
 *  structure — exactly as defined by professional price action methodology.
 *
 *  Pipeline:
 *    Raw Candle  →  Swing Detection  →  Swing Classification
 *                →  External Structure Update
 *                →  BOS / CHoCH Detection (BODY CLOSE, not wick)
 *                →  Trend State  →  Emit Event
 *
 *  Rules:
 *  ─────
 *  BULLISH trend
 *    • External High  : a Higher High (extends the ceiling) → updates anchorHigh
 *    • External Low   : a Higher Low  (rising floor confirmed) → updates anchorLow
 *    • Internal High  : a Lower High during pullback → IGNORED as noise
 *    • Internal Low   : a Lower Low  → POTENTIAL CHOCH; checked via candle body close
 *
 *  BEARISH trend (mirror)
 *    • External Low   : a Lower Low  → updates anchorLow
 *    • External High  : a Lower High → updates anchorHigh
 *    • Internal Low   : a Higher Low → IGNORED
 *    • Internal High  : a Higher High → POTENTIAL CHOCH
 *
 *  BOS  : candle BODY closes BEYOND the current anchor (trend continuation).
 *  CHoCH: candle BODY closes BEYOND the opposite anchor (trend reversal).
 *
 *  "Body close" means: Math.min(open, close) > level  (for bullish breaks)
 *                       Math.max(open, close) < level  (for bearish breaks)
 *  This ignores wicks, shadows and noise spikes that don't truly break structure.
 *
 *  Pullback tracking:
 *  ─────────────────
 *  During a BULLISH pullback (internal bearish sub-structure):
 *    pullbackLow tracks the deepest wick low reached.
 *    When a new Bullish BOS fires, the structural floor advances to pullbackLow.
 *
 *  During a BEARISH pullback (internal bullish sub-structure):
 *    pullbackHigh tracks the highest wick high reached.
 *    When a new Bearish BOS fires, the structural ceiling falls to pullbackHigh.
 *
 *  This ensures anchorLow / anchorHigh always represent the most recent
 *  EXTERNAL structural inflection — never internal noise.
 * ══════════════════════════════════════════════════════════════════════════
 */

const BULLISH = 1;
const BEARISH = 0;

// ── State persisted across candles ───────────────────────────────────────

export interface StructureState {
  /** Current macro trend direction */
  currentTrend: number; // BULLISH | BEARISH

  /** The most recent EXTERNAL swing high level.
   *  BULLISH: the ceiling that must be broken for BOS continuation.
   *  BEARISH: the falling ceiling confirming lower highs. */
  anchorHigh: number | null;
  anchorHighEpoch: number;

  /** The most recent EXTERNAL swing low level.
   *  BEARISH: the floor that must be broken for BOS continuation.
   *  BULLISH: the rising floor confirming higher lows. */
  anchorLow: number | null;
  anchorLowEpoch: number;

  /** Deepest wick low reached during the current pullback in a bullish trend.
   *  Advances anchorLow forward after a BOS fires. */
  pullbackLow: number | null;

  /** Highest wick high reached during the current pullback in a bearish trend.
   *  Advances anchorHigh downward after a BOS fires. */
  pullbackHigh: number | null;

  /** Epoch of the last fully processed candle (deduplication guard) */
  lastProcessedEpoch: number;
}

export function createInitialStructureState(): StructureState {
  return {
    currentTrend: BEARISH,
    anchorHigh: null,
    anchorHighEpoch: 0,
    anchorLow: null,
    anchorLowEpoch: 0,
    pullbackLow: null,
    pullbackHigh: null,
    lastProcessedEpoch: 0,
  };
}

// ── Event output type ─────────────────────────────────────────────────────

export interface StructureEvent {
  event: 'Bullish CHoCH' | 'Bullish BOS' | 'Bearish CHoCH' | 'Bearish BOS';
  direction: 'BULLISH' | 'BEARISH';
  price: number;
  pivotLevel: number;
  trendBefore: 'BULLISH' | 'BEARISH';
  trendAfter: 'BULLISH' | 'BEARISH';
  candleEpoch: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** True if the candle body CLOSES ABOVE level (wick excluded). */
function bodyClosesAbove(c: Candle, level: number): boolean {
  return Math.max(c.open, c.close) > level && c.close > level;
}

/** True if the candle body CLOSES BELOW level (wick excluded). */
function bodyClosesBelow(c: Candle, level: number): boolean {
  return Math.min(c.open, c.close) < level && c.close < level;
}

// ── Defensive: Validate candle interval matches expected timeframe ────────

const TF_SEC: Record<string, number> = {
  '5m': 5 * 60,
  '15m': 15 * 60,
  '1m': 60,
};

/**
 * Checks that the last few candles are spaced like the claimed timeframe.
 * Catches aggregation bugs (e.g. a "15m" buffer built from 1s ticks).
 */
export function validateCandleInterval(
  candles: Candle[],
  timeframeKey: string,
  toleranceRatio = 0.2
): boolean {
  const expectedSec = TF_SEC[timeframeKey];
  if (!expectedSec) return true;
  if (candles.length < 4) return false;

  const recent = candles.slice(-5);
  const tolerance = expectedSec * toleranceRatio;

  for (let i = 1; i < recent.length; i++) {
    const gap = recent[i].epoch - recent[i - 1].epoch;
    if (Math.abs(gap - expectedSec) > tolerance) return false;
  }
  return true;
}

// ── Engine class ──────────────────────────────────────────────────────────

export class StructureEngine {
  private state: StructureState;

  constructor(state: StructureState) {
    this.state = state;
  }

  getState(): StructureState {
    return this.state;
  }

  /**
   * Process a sorted array of closed candles.
   * Call this with the full window on history init (events are suppressed — no emit).
   * Call with [last_N, new_candle] on live ticks — events are returned for emitting.
   *
   * We need at least pivotBars candles to form a raw swing, so we use a 3-bar pivot
   * confirmation: a candle at index [i] is a swing high if it is the highest high
   * in [i-1, i, i+1].  Because we only process closed candles we have confirmed data.
   */
  process(candles: Candle[]): StructureEvent[] {
    const events: StructureEvent[] = [];

    // Need at least 3 candles to form a 1-bar-left + 1-bar-right pivot
    if (candles.length < 3) return events;

    for (let i = 1; i < candles.length - 1; i++) {
      const pivot    = candles[i];
      const prevBar  = candles[i - 1];
      const nextBar  = candles[i + 1];

      // The "current" candle we evaluate for BOS/CHoCH is the confirmation bar (nextBar)
      const current = nextBar;

      if (current.epoch <= this.state.lastProcessedEpoch) continue;

      // ── Phase 1: Raw Swing Detection (3-bar pivot) ──────────────────────
      //
      // A "raw swing high" = the middle bar's high is higher than both neighbours.
      // A "raw swing low"  = the middle bar's low  is lower  than both neighbours.
      // We compare HIGH of middle vs HIGH of neighbours (and LOW vs LOW).

      const isRawHigh = pivot.high >= prevBar.high && pivot.high > nextBar.high;
      const isRawLow  = pivot.low  <= prevBar.low  && pivot.low  < nextBar.low;

      // ── Phase 2 & 3: Classify swing & update external anchors ───────────
      if (isRawHigh) {
        if (this.state.currentTrend === BULLISH) {
          // In bullish trend: structural only if it extends the ceiling (Higher High)
          if (this.state.anchorHigh === null || pivot.high > this.state.anchorHigh) {
            this.state.anchorHigh      = pivot.high;
            this.state.anchorHighEpoch = pivot.epoch;
            // Reset pullback low: new ceiling means we are at the top; next dip is fresh pullback
            this.state.pullbackLow = null;
          }
          // Lower High in bullish = internal noise → ignored
        } else {
          // In bearish trend: structural only if it falls (Lower High — confirms bear ceiling)
          if (this.state.anchorHigh === null || pivot.high < this.state.anchorHigh) {
            this.state.anchorHigh      = pivot.high;
            this.state.anchorHighEpoch = pivot.epoch;
            this.state.pullbackHigh = null;
          }
          // Higher High in bearish = potential CHoCH → detected by body-close check below
        }
      }

      if (isRawLow) {
        if (this.state.currentTrend === BULLISH) {
          // Structural only if it rises (Higher Low — confirms bull floor)
          if (this.state.anchorLow === null || pivot.low > this.state.anchorLow) {
            this.state.anchorLow      = pivot.low;
            this.state.anchorLowEpoch = pivot.epoch;
            this.state.pullbackLow = null;
          }
          // Lower Low in bullish = potential CHoCH → detected by body-close check below
        } else {
          // In bearish trend: structural only if it extends the floor (Lower Low)
          if (this.state.anchorLow === null || pivot.low < this.state.anchorLow) {
            this.state.anchorLow      = pivot.low;
            this.state.anchorLowEpoch = pivot.epoch;
            this.state.pullbackHigh = null;
          }
          // Higher Low in bearish = internal noise → ignored
        }
      }

      // ── Phase 4: Track pullback extremes ────────────────────────────────
      // While price is retracing between anchors, track the deepest point
      // so we can advance the structural floor/ceiling accurately after BOS.
      if (this.state.currentTrend === BULLISH) {
        if (this.state.pullbackLow === null || current.low < this.state.pullbackLow) {
          this.state.pullbackLow = current.low;
        }
      } else {
        if (this.state.pullbackHigh === null || current.high > this.state.pullbackHigh) {
          this.state.pullbackHigh = current.high;
        }
      }

      // ── Phase 5: BOS / CHoCH detection (BODY CLOSE only) ───────────────
      if (this.state.currentTrend === BULLISH) {

        // ── BULLISH BOS ─────────────────────────────────────────────────
        // Price body closes ABOVE the structural ceiling → trend continuation
        if (this.state.anchorHigh !== null && bodyClosesAbove(current, this.state.anchorHigh)) {
          const brokenLevel = this.state.anchorHigh;

          // Advance the floor to the deepest pullback before this BOS
          const newFloor = this.state.pullbackLow ?? this.state.anchorLow;

          events.push({
            event: 'Bullish BOS',
            direction: 'BULLISH',
            price: current.close,
            pivotLevel: brokenLevel,
            trendBefore: 'BULLISH',
            trendAfter: 'BULLISH',
            candleEpoch: current.epoch,
          });

          // Reset ceiling — the next raw Higher High becomes the new target
          this.state.anchorHigh      = null;
          this.state.anchorHighEpoch = 0;

          // Advance the structural floor to the most recent pullback low
          if (newFloor !== null) {
            this.state.anchorLow      = newFloor;
            this.state.anchorLowEpoch = current.epoch;
          }

          // Reset pullback trackers
          this.state.pullbackLow  = null;
          this.state.pullbackHigh = null;
        }

        // ── BEARISH CHoCH ────────────────────────────────────────────────
        // Price body closes BELOW the structural floor → trend reversal
        else if (this.state.anchorLow !== null && bodyClosesBelow(current, this.state.anchorLow)) {
          const brokenLevel = this.state.anchorLow;

          events.push({
            event: 'Bearish CHoCH',
            direction: 'BEARISH',
            price: current.close,
            pivotLevel: brokenLevel,
            trendBefore: 'BULLISH',
            trendAfter: 'BEARISH',
            candleEpoch: current.epoch,
          });

          this.state.currentTrend    = BEARISH;
          this.state.anchorLow       = null;
          this.state.anchorLowEpoch  = 0;
          this.state.pullbackLow     = null;
          this.state.pullbackHigh    = null;
        }

      } else { // BEARISH

        // ── BEARISH BOS ─────────────────────────────────────────────────
        // Price body closes BELOW the structural floor → trend continuation
        if (this.state.anchorLow !== null && bodyClosesBelow(current, this.state.anchorLow)) {
          const brokenLevel = this.state.anchorLow;

          // Advance the ceiling down to the highest pullback before this BOS
          const newCeiling = this.state.pullbackHigh ?? this.state.anchorHigh;

          events.push({
            event: 'Bearish BOS',
            direction: 'BEARISH',
            price: current.close,
            pivotLevel: brokenLevel,
            trendBefore: 'BEARISH',
            trendAfter: 'BEARISH',
            candleEpoch: current.epoch,
          });

          this.state.anchorLow       = null;
          this.state.anchorLowEpoch  = 0;

          if (newCeiling !== null) {
            this.state.anchorHigh      = newCeiling;
            this.state.anchorHighEpoch = current.epoch;
          }

          this.state.pullbackLow  = null;
          this.state.pullbackHigh = null;
        }

        // ── BULLISH CHoCH ────────────────────────────────────────────────
        // Price body closes ABOVE the structural ceiling → trend reversal
        else if (this.state.anchorHigh !== null && bodyClosesAbove(current, this.state.anchorHigh)) {
          const brokenLevel = this.state.anchorHigh;

          events.push({
            event: 'Bullish CHoCH',
            direction: 'BULLISH',
            price: current.close,
            pivotLevel: brokenLevel,
            trendBefore: 'BEARISH',
            trendAfter: 'BULLISH',
            candleEpoch: current.epoch,
          });

          this.state.currentTrend     = BULLISH;
          this.state.anchorHigh       = null;
          this.state.anchorHighEpoch  = 0;
          this.state.pullbackLow      = null;
          this.state.pullbackHigh     = null;
        }
      }

      this.state.lastProcessedEpoch = current.epoch;
    }

    return events;
  }
}
