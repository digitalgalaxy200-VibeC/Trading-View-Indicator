import { Candle } from '../types';
import { config } from '../config/env';

const BULLISH = 1;
const BEARISH = 0;

export interface PivotState {
  activeSwingHigh: number | null;
  activeSwingHighCrossed: boolean;
  activeSwingLow: number | null;
  activeSwingLowCrossed: boolean;
  currentTrend: number; // BULLISH (1) | BEARISH (0)
  lastProcessedEpoch: number;
}

export function createInitialPivotState(): PivotState {
  return {
    activeSwingHigh: null,
    activeSwingHighCrossed: false,
    activeSwingLow: null,
    activeSwingLowCrossed: false,
    currentTrend: BEARISH,
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
   * Process an array of candles (oldest to newest) and return any breakout events.
   * Only candles with epoch > lastProcessedEpoch are processed.
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

      // Check for newly confirmed pivots
      const pivotIdx = i - pivotLen;
      const potentialPivot = candles[pivotIdx];
      const windowCandles = candles.slice(pivotIdx + 1, i + 1);

      let highestInWindow = -Infinity;
      let lowestInWindow = Infinity;
      for (const c of windowCandles) {
        if (c.high > highestInWindow) highestInWindow = c.high;
        if (c.low < lowestInWindow) lowestInWindow = c.low;
      }

      // Confirm swing high
      if (potentialPivot.high > highestInWindow) {
        this.state.activeSwingHigh = potentialPivot.high;
        this.state.activeSwingHighCrossed = false;
      }

      // Confirm swing low
      if (potentialPivot.low < lowestInWindow) {
        this.state.activeSwingLow = potentialPivot.low;
        this.state.activeSwingLowCrossed = false;
      }

      // Check for BOS/CHOCH breakouts
      const close = currentCandle.close;
      const trendBefore = this.state.currentTrend === BULLISH ? 'BULLISH' as const : 'BEARISH' as const;

      // Bullish breakout
      if (this.state.activeSwingHigh !== null && !this.state.activeSwingHighCrossed && close > this.state.activeSwingHigh) {
        this.state.activeSwingHighCrossed = true;
        const isChoch = this.state.currentTrend === BEARISH;
        this.state.currentTrend = BULLISH;

        events.push({
          event: isChoch ? 'Bullish CHoCH' : 'Bullish BOS',
          direction: 'BULLISH',
          price: close,
          pivotLevel: this.state.activeSwingHigh,
          trendBefore,
          trendAfter: 'BULLISH',
          candleEpoch: currentCandle.epoch,
        });
      }
      // Bearish breakout
      else if (this.state.activeSwingLow !== null && !this.state.activeSwingLowCrossed && close < this.state.activeSwingLow) {
        this.state.activeSwingLowCrossed = true;
        const isChoch = this.state.currentTrend === BULLISH;
        this.state.currentTrend = BEARISH;

        events.push({
          event: isChoch ? 'Bearish CHoCH' : 'Bearish BOS',
          direction: 'BEARISH',
          price: close,
          pivotLevel: this.state.activeSwingLow,
          trendBefore,
          trendAfter: 'BEARISH',
          candleEpoch: currentCandle.epoch,
        });
      }

      this.state.lastProcessedEpoch = currentCandle.epoch;
    }

    return events;
  }
}
