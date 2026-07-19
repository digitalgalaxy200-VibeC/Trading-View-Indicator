import { Candle } from '../types';
import { config } from '../config/env';

const BULLISH = 1;
const BEARISH = 0;

export interface PivotState {
  currentTrend: number; // BULLISH (1) | BEARISH (0)

  // ─── PHASE 3: CONFIRMED EXTERNAL STRUCTURE ────────────────────────────────
  // These are the ONLY levels used for BOS / CHOCH detection.
  // They are updated exclusively by the Swing Classification Layer (Phase 2).
  // Small internal pivots that do not extend the dominant trend are ignored.

  anchorHigh: number | null;  // BULLISH: current structural ceiling (breaks → BOS)
  anchorHighEpoch: number;    // BEARISH: last confirmed Lower High (breaks → CHOCH)

  anchorLow: number | null;   // BEARISH: current structural floor (breaks → BOS)
  anchorLowEpoch: number;     // BULLISH: last confirmed Higher Low (breaks → CHOCH)

  lastProcessedEpoch: number;
}

export function createInitialPivotState(): PivotState {
  return {
    currentTrend: BEARISH,
    anchorHigh: null,
    anchorHighEpoch: 0,
    anchorLow: null,
    anchorLowEpoch: 0,
    lastProcessedEpoch: 0,
  };
}

export class PivotDetector {
  private state: PivotState;

  constructor(state: PivotState) {
    this.state = state;
  }

  getState(): PivotState {
    return this.state;
  }

  /**
   * NEW 5-PHASE PIPELINE
   *
   * Phase 1 — Raw Swing Detection    : fast 5-bar pivot math
   * Phase 2 — Swing Classification   : is this pivot structurally significant?
   * Phase 3 — External Structure     : update anchorHigh / anchorLow only from classified swings
   * Phase 4 — BOS / CHOCH Detection  : compare close against anchors
   * Phase 5 — Trend State Update     : flip trend on CHOCH, keep on BOS
   */
  process(candles: Candle[]): {
    event: 'Bullish CHoCH' | 'Bullish BOS' | 'Bearish CHoCH' | 'Bearish BOS';
    direction: 'BULLISH' | 'BEARISH';
    price: number;
    pivotLevel: number;
    trendBefore: 'BULLISH' | 'BEARISH';
    trendAfter: 'BULLISH' | 'BEARISH';
    candleEpoch: number;
  }[] {
    const events: any[] = [];
    const pivotLen = config.pivotLength;

    if (candles.length <= pivotLen) return events;

    for (let i = pivotLen; i < candles.length; i++) {
      const currentCandle = candles[i];
      if (currentCandle.epoch <= this.state.lastProcessedEpoch) continue;

      // ── PHASE 1: Raw Swing Detection ─────────────────────────────────────
      const pivotIdx = i - pivotLen;
      const potentialPivot = candles[pivotIdx];
      const windowCandles = candles.slice(pivotIdx + 1, i + 1);

      let highestInWindow = -Infinity;
      let lowestInWindow = Infinity;
      for (const c of windowCandles) {
        if (c.high > highestInWindow) highestInWindow = c.high;
        if (c.low < lowestInWindow) lowestInWindow = c.low;
      }

      const isRawPivotHigh = potentialPivot.high > highestInWindow;
      const isRawPivotLow  = potentialPivot.low  < lowestInWindow;

      // ── PHASE 2 & 3: Swing Classification → External Structure Update ─────
      //
      // The rule is simple: a swing is STRUCTURAL only if it EXTENDS the trend.
      //
      // BULLISH trend:
      //   Structural High = a Higher High  → updates anchorHigh (the ceiling)
      //   Structural Low  = a Higher Low   → updates anchorLow  (the rising floor)
      //   Internal High   = a Lower High   → ignored (minor pullback resistance)
      //   Internal Low    = a Lower Low    → ignored by pivot classifier; caught by CHOCH check
      //
      // BEARISH trend:
      //   Structural Low  = a Lower Low    → updates anchorLow  (the floor)
      //   Structural High = a Lower High   → updates anchorHigh (the falling ceiling)
      //   Internal Low    = a Higher Low   → ignored (minor pullback support)
      //   Internal High   = a Higher High  → ignored; caught by CHOCH check

      if (isRawPivotHigh) {
        if (this.state.currentTrend === BULLISH) {
          // Structural only if it is a Higher High (extends the bullish ceiling)
          if (this.state.anchorHigh === null || potentialPivot.high > this.state.anchorHigh) {
            this.state.anchorHigh      = potentialPivot.high;
            this.state.anchorHighEpoch = potentialPivot.epoch;
          }
          // Lower Highs in a bullish trend are internal → skip
        } else {
          // BEARISH: Structural only if it is a Lower High (falling ceiling confirms bear trend)
          if (this.state.anchorHigh === null || potentialPivot.high < this.state.anchorHigh) {
            this.state.anchorHigh      = potentialPivot.high;
            this.state.anchorHighEpoch = potentialPivot.epoch;
          }
          // Higher Highs in a bearish trend → potential CHOCH, but detected by close check below
        }
      }

      if (isRawPivotLow) {
        if (this.state.currentTrend === BULLISH) {
          // Structural only if it is a Higher Low (rising floor confirms bull trend)
          if (this.state.anchorLow === null || potentialPivot.low > this.state.anchorLow) {
            this.state.anchorLow      = potentialPivot.low;
            this.state.anchorLowEpoch = potentialPivot.epoch;
          }
          // Lower Lows in bullish → potential CHOCH, caught by close check below
        } else {
          // BEARISH: Structural only if it is a Lower Low (extends the bearish floor)
          if (this.state.anchorLow === null || potentialPivot.low < this.state.anchorLow) {
            this.state.anchorLow      = potentialPivot.low;
            this.state.anchorLowEpoch = potentialPivot.epoch;
          }
          // Higher Lows in bearish → internal → skip
        }
      }

      // ── PHASE 4 & 5: BOS / CHOCH Detection & Trend State ─────────────────
      const close = currentCandle.close;

      if (this.state.currentTrend === BULLISH) {

        // Bullish BOS — price closes above the structural ceiling (trend continuation)
        if (this.state.anchorHigh !== null && close > this.state.anchorHigh) {
          const brokenLevel = this.state.anchorHigh;
          const brokenEpoch = this.state.anchorHighEpoch;

          // Reset ceiling; anchorLow (the Higher Low support) stays in place
          this.state.anchorHigh      = null;
          this.state.anchorHighEpoch = 0;

          events.push({
            event: 'Bullish BOS',
            direction: 'BULLISH',
            price: close,
            pivotLevel: brokenLevel,
            trendBefore: 'BULLISH',
            trendAfter: 'BULLISH',
            candleEpoch: currentCandle.epoch,
          });
        }

        // Bearish CHOCH — price closes below the structural floor (trend reversal)
        else if (this.state.anchorLow !== null && close < this.state.anchorLow) {
          const brokenLevel = this.state.anchorLow;

          // Flip to BEARISH. anchorHigh (the failed structural ceiling) becomes the new resistance.
          this.state.currentTrend    = BEARISH;
          this.state.anchorLow       = null;
          this.state.anchorLowEpoch  = 0;

          events.push({
            event: 'Bearish CHoCH',
            direction: 'BEARISH',
            price: close,
            pivotLevel: brokenLevel,
            trendBefore: 'BULLISH',
            trendAfter: 'BEARISH',
            candleEpoch: currentCandle.epoch,
          });
        }

      } else { // BEARISH

        // Bearish BOS — price closes below the structural floor (trend continuation)
        if (this.state.anchorLow !== null && close < this.state.anchorLow) {
          const brokenLevel = this.state.anchorLow;

          // Reset floor; anchorHigh (the Lower High resistance) stays in place
          this.state.anchorLow       = null;
          this.state.anchorLowEpoch  = 0;

          events.push({
            event: 'Bearish BOS',
            direction: 'BEARISH',
            price: close,
            pivotLevel: brokenLevel,
            trendBefore: 'BEARISH',
            trendAfter: 'BEARISH',
            candleEpoch: currentCandle.epoch,
          });
        }

        // Bullish CHOCH — price closes above the structural ceiling (trend reversal)
        else if (this.state.anchorHigh !== null && close > this.state.anchorHigh) {
          const brokenLevel = this.state.anchorHigh;

          // Flip to BULLISH. anchorLow (the failed structural floor) becomes the new support.
          this.state.currentTrend    = BULLISH;
          this.state.anchorHigh      = null;
          this.state.anchorHighEpoch = 0;

          events.push({
            event: 'Bullish CHoCH',
            direction: 'BULLISH',
            price: close,
            pivotLevel: brokenLevel,
            trendBefore: 'BEARISH',
            trendAfter: 'BULLISH',
            candleEpoch: currentCandle.epoch,
          });
        }
      }

      this.state.lastProcessedEpoch = currentCandle.epoch;
    }

    return events;
  }
}
