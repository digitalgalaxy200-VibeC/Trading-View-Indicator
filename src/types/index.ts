export interface Candle {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type Trend = 'BULLISH' | 'BEARISH';

export interface MarketStructureState {
  currentTrend: Trend;
  activeSwingHigh: number | null;
  activeSwingHighCrossed: boolean;
  activeSwingLow: number | null;
  activeSwingLowCrossed: boolean;
  lastProcessedEpoch: number;
}

export interface BreakoutEvent {
  id: string; // Unique ID for deduplication: e.g. "Bullish BOS_1690000000_123.45"
  event: 'Bullish BOS' | 'Bearish BOS' | 'Bullish CHoCH' | 'Bearish CHoCH';
  direction: Trend;
  price: number;
  trendBefore: Trend;
  trendAfter: Trend;
  pivotLevel: number;
  epoch: number;
}
