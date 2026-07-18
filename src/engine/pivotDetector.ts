import { Candle } from '../types';
import { config } from '../config/env';

const BULLISH = 1;
const BEARISH = 0;

export interface PivotState {
  currentTrend: number; // BULLISH (1) | BEARISH (0)
  
  // The macro structural anchors
  externalHigh: number | null; 
  externalLow: number | null;
  
  // Trackers for the current leg/pullback
  candidateHigh: number | null;
  candidateLow: number | null;
  
  lastProcessedEpoch: number;
}

export function createInitialPivotState(): PivotState {
  return {
    currentTrend: BEARISH, // Default, will self-correct during history replay
    externalHigh: null,
    externalLow: null,
    candidateHigh: null,
    candidateLow: null,
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

      // 1. Check for newly confirmed 5-bar pivots
      const pivotIdx = i - pivotLen;
      const potentialPivot = candles[pivotIdx];
      const windowCandles = candles.slice(pivotIdx + 1, i + 1);

      let highestInWindow = -Infinity;
      let lowestInWindow = Infinity;
      for (const c of windowCandles) {
        if (c.high > highestInWindow) highestInWindow = c.high;
        if (c.low < lowestInWindow) lowestInWindow = c.low;
      }

      // Confirm Swing High
      if (potentialPivot.high > highestInWindow) {
        this.state.candidateHigh = Math.max(this.state.candidateHigh ?? -Infinity, potentialPivot.high);
        
        // If in Bullish trend and we don't have a macro resistance yet, this is it.
        if (this.state.currentTrend === BULLISH && this.state.externalHigh === null) {
          this.state.externalHigh = potentialPivot.high;
        }
      }

      // Confirm Swing Low
      if (potentialPivot.low < lowestInWindow) {
        this.state.candidateLow = Math.min(this.state.candidateLow ?? Infinity, potentialPivot.low);
        
        // If in Bearish trend and we don't have a macro support yet, this is it.
        if (this.state.currentTrend === BEARISH && this.state.externalLow === null) {
          this.state.externalLow = potentialPivot.low;
        }
      }

      // 2. Check for Macro Structural Breakouts (External BOS / CHOCH)
      const close = currentCandle.close;

      if (this.state.currentTrend === BULLISH) {
        // Bullish BOS (Trend Continuation)
        if (this.state.externalHigh !== null && close > this.state.externalHigh) {
          const brokenLevel = this.state.externalHigh;
          
          // The new Strong Low is the lowest point of the pullback we just finished
          if (this.state.candidateLow !== null) {
            this.state.externalLow = this.state.candidateLow;
          }
          
          // Reset for price discovery
          this.state.externalHigh = null; 
          this.state.candidateLow = null; 
          this.state.candidateHigh = null;

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
        // Bearish CHOCH (Trend Reversal)
        else if (this.state.externalLow !== null && close < this.state.externalLow) {
          const brokenLevel = this.state.externalLow;
          
          this.state.currentTrend = BEARISH;
          
          // The new Strong High is the highest point of the structure that failed
          if (this.state.candidateHigh !== null) {
            this.state.externalHigh = this.state.candidateHigh;
          }
          
          // Reset for price discovery
          this.state.externalLow = null;
          this.state.candidateHigh = null;
          this.state.candidateLow = null;

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
      } 
      else { // BEARISH TREND
        // Bearish BOS (Trend Continuation)
        if (this.state.externalLow !== null && close < this.state.externalLow) {
          const brokenLevel = this.state.externalLow;
          
          // The new Strong High is the highest point of the pullback we just finished
          if (this.state.candidateHigh !== null) {
            this.state.externalHigh = this.state.candidateHigh;
          }
          
          // Reset for price discovery
          this.state.externalLow = null;
          this.state.candidateHigh = null;
          this.state.candidateLow = null;

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
        // Bullish CHOCH (Trend Reversal)
        else if (this.state.externalHigh !== null && close > this.state.externalHigh) {
          const brokenLevel = this.state.externalHigh;
          
          this.state.currentTrend = BULLISH;
          
          // The new Strong Low is the lowest point of the structure that failed
          if (this.state.candidateLow !== null) {
            this.state.externalLow = this.state.candidateLow;
          }
          
          // Reset for price discovery
          this.state.externalHigh = null;
          this.state.candidateLow = null;
          this.state.candidateHigh = null;

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
