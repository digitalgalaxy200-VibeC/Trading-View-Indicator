import { Candle } from '../types';
import { StructureEngine, StructureState, createInitialStructureState } from './structureEngine';

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
  private engine: StructureEngine;
  private onEvent: EventHandler;
  private initialized = false;

  constructor(onEvent: EventHandler, state?: StructureState) {
    this.onEvent = onEvent;
    this.engine = new StructureEngine(state || createInitialStructureState());
  }

  getState(): StructureState {
    return this.engine.getState();
  }

  initializeHistory(historicalCandles: Candle[]): void {
    this.candles = historicalCandles.sort((a, b) => a.epoch - b.epoch);
    this.initialized = true;
    console.log(`  CandleManager: loaded ${this.candles.length} historical candles.`);

    // Silently process history to hydrate structural state — no events emitted
    this.engine.process(this.candles);
  }

  onNewCandleClosed(candle: Candle): void {
    if (!this.initialized) return;

    this.candles.push(candle);

    // Keep only the last 300 candles to bound memory
    // (we need more than old engine since 3-bar pivot needs neighbours)
    if (this.candles.length > 300) {
      this.candles = this.candles.slice(-300);
    }

    const events = this.engine.process(this.candles);
    for (const event of events) {
      this.onEvent(event);
    }
  }
}
