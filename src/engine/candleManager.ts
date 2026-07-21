import { Candle, ContinuationState, StructureEvent } from '../types';
import { createStructureState, updateStructure } from './structureEngine';

export class CandleManager {
  private candles15m: Candle[] = [];
  private candles5m: Candle[] = [];
  
  private state15m: ContinuationState;
  private state5m: ContinuationState;
  
  private pivotLen: number;

  constructor(symbol: string, pivotLen: number) {
    this.pivotLen = pivotLen;
    this.state15m = createStructureState(symbol, '15m');
    this.state5m = createStructureState(symbol, '5m');
  }

  getHtfState(): ContinuationState {
    return this.state15m;
  }

  getLtfState(): ContinuationState {
    return this.state5m;
  }

  initializeHistory(timeframe: string, historicalCandles: Candle[]): void {
    const sorted = historicalCandles.sort((a, b) => a.time - b.time);
    
    if (timeframe === '15m') {
      this.candles15m = sorted;
      // Replay history
      for (let i = this.pivotLen + 1; i <= this.candles15m.length; i++) {
        const slice = this.candles15m.slice(0, i);
        const { state } = updateStructure(this.state15m, slice, this.pivotLen);
        this.state15m = state;
      }
    } else if (timeframe === '5m') {
      this.candles5m = sorted;
      // Replay history
      for (let i = this.pivotLen + 1; i <= this.candles5m.length; i++) {
        const slice = this.candles5m.slice(0, i);
        const { state } = updateStructure(this.state5m, slice, this.pivotLen);
        this.state5m = state;
      }
    }
  }

  onNewCandleClosed(timeframe: string, candle: Candle): { state: ContinuationState, event: StructureEvent | null } | null {
    if (timeframe === '15m') {
      this.candles15m.push(candle);
      if (this.candles15m.length > 300) this.candles15m = this.candles15m.slice(-300);
      const res = updateStructure(this.state15m, this.candles15m, this.pivotLen);
      this.state15m = res.state;
      return res; // We only care about bias from HTF, but returning event is fine
    } else if (timeframe === '5m') {
      this.candles5m.push(candle);
      if (this.candles5m.length > 300) this.candles5m = this.candles5m.slice(-300);
      const res = updateStructure(this.state5m, this.candles5m, this.pivotLen);
      this.state5m = res.state;
      return res; // LTF event drives continuation Engine
    }
    return null;
  }
}
