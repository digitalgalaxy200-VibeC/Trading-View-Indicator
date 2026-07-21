import { Candle, ContinuationState, StructureEvent, SwingPoint } from '../types';
import { detectNewPivot } from './pivotDetector';

export function createStructureState(symbol: string, timeframe: string): ContinuationState {
  return {
    symbol,
    timeframe,
    stage: 'IDLE',
    bias: 'neutral',
    leg: null,
    fib: null,
    trade: null,
    confirmCount: 0,
    lastSwingHigh: null,
    lastSwingLow: null,
    highBroken: false,
    lowBroken: false,
  };
}

/**
 * Call on every new closed candle for a symbol/timeframe. Mutates and
 * returns the updated state, plus any structure event that just fired.
 * Does NOT decide trade entries — that's continuationEngine.ts.
 */
export function updateStructure(
  state: ContinuationState,
  candles: Candle[],
  pivotLen: number
): { state: ContinuationState; event: StructureEvent | null } {
  const newPivot = detectNewPivot(candles, pivotLen);

  if (newPivot?.type === 'high') {
    state.lastSwingHigh = newPivot;
    state.highBroken = false;
  }
  if (newPivot?.type === 'low') {
    state.lastSwingLow = newPivot;
    state.lowBroken = false;
  }

  const latest = candles[candles.length - 1];
  const bullBreak =
    !!state.lastSwingHigh && !state.highBroken && latest.close > state.lastSwingHigh.price;
  const bearBreak =
    !!state.lastSwingLow && !state.lowBroken && latest.close < state.lastSwingLow.price;

  let event: StructureEvent | null = null;

  if (bullBreak && state.lastSwingHigh && state.lastSwingLow) {
    const isChoch = state.bias !== 'bullish';
    state.highBroken = true;
    event = {
      symbol: state.symbol,
      timeframe: state.timeframe,
      type: isChoch ? 'CHOCH' : 'BOS',
      direction: 'bullish',
      price: state.lastSwingHigh.price,
      time: latest.time,
      leg: {
        direction: 'bullish',
        originPrice: state.lastSwingLow.price,   // higher low
        originTime: state.lastSwingLow.time,
        extremePrice: state.lastSwingHigh.price, // higher high just broken
        extremeTime: state.lastSwingHigh.time,
      },
    };
    state.bias = 'bullish';
  } else if (bearBreak && state.lastSwingLow && state.lastSwingHigh) {
    const isChoch = state.bias !== 'bearish';
    state.lowBroken = true;
    event = {
      symbol: state.symbol,
      timeframe: state.timeframe,
      type: isChoch ? 'CHOCH' : 'BOS',
      direction: 'bearish',
      price: state.lastSwingLow.price,
      time: latest.time,
      leg: {
        direction: 'bearish',
        originPrice: state.lastSwingHigh.price,  // lower high
        originTime: state.lastSwingHigh.time,
        extremePrice: state.lastSwingLow.price,  // lower low just broken
        extremeTime: state.lastSwingLow.time,
      },
    };
    state.bias = 'bearish';
  }

  return { state, event };
}
