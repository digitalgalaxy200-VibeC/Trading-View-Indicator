import { Candle } from '../types';
import { PivotDetector, PivotState, createInitialPivotState } from './pivotDetector';

export type EventHandler = (event: {
  event: 'Bullish CHoCH' | 'Bullish BOS' | 'Bearish CHoCH' | 'Bearish BOS';
  direction: 'BULLISH' | 'BEARISH';
  price: number;
  pivotLevel: number;
  trendBefore: 'BULLISH' | 'BEARISH';
  trendAfter: 'BULLISH' | 'BEARISH';
  candleEpoch: number;
}) => void;

export class CandleManager {
  private candles: Candle[] = [];
  private detector: PivotDetector;
  private onEvent: EventHandler;
  private initialized = false;

  constructor(onEvent: EventHandler, state?: PivotState) {
    this.onEvent = onEvent;
    this.detector = new PivotDetector(state || createInitialPivotState());
  }

  getState(): PivotState {
    return this.detector.getState();
  }

  initializeHistory(historicalCandles: Candle[]): void {
    this.candles = historicalCandles.sort((a, b) => a.epoch - b.epoch);
    this.initialized = true;
    console.log(`  CandleManager: loaded ${this.candles.length} historical candles.`);

    // Process historical candles to rebuild pivot state (but don't emit events for old data)
    this.detector.process(this.candles);
  }

  onNewCandleClosed(candle: Candle): void {
    if (!this.initialized) return;

    this.candles.push(candle);

    // Keep only the last 200 candles to bound memory
    if (this.candles.length > 200) {
      this.candles = this.candles.slice(-200);
    }

    const events = this.detector.process(this.candles);
    for (const event of events) {
      this.onEvent(event);
    }
  }
}
