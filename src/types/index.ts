// ── Market Structure Events ──

export interface BreakoutEvent {
  symbol: string;
  event: 'Bullish CHoCH' | 'Bullish BOS' | 'Bearish CHoCH' | 'Bearish BOS';
  direction: 'BULLISH' | 'BEARISH';
  price: number;
  pivotLevel: number;
  trendBefore: 'BULLISH' | 'BEARISH';
  trendAfter: 'BULLISH' | 'BEARISH';
  candleEpoch: number;
}

// ── Candle Data ──

export interface Candle {
  symbol: string;
  timeframe: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

// ── Database Row Types ──

export interface SymbolRow {
  id: number;
  ticker: string;
  label: string;
  active: number;       // SQLite boolean
  created_at: number;
}

export interface EventRow {
  id: number;
  symbol_id: number;
  event_type: string;
  direction: string;
  price: number;
  pivot_level: number;
  trend_before: string;
  trend_after: string;
  candle_epoch: number;
  created_at: number;
}

export interface AlertRow {
  id: number;
  event_id: number;
  status: 'pending' | 'sent' | 'suppressed';
  email_id: number | null;
  created_at: number;
  sent_at: number | null;
}

export interface AlertWithDetails extends AlertRow {
  ticker: string;
  event_type: string;
  direction: string;
  price: number;
  trend_before: string;
  trend_after: string;
  pivot_level: number;
  candle_epoch: number;
}

export interface EmailRow {
  id: number;
  alert_count: number;
  ai_summary: string;
  status: 'sent' | 'failed';
  resend_id: string | null;
  sent_at: number;
}

export interface MarketStateRow {
  symbol_id: number;
  current_trend: string;
  last_bos_price: number | null;
  last_choch_price: number | null;
  last_event_at: number | null;
  updated_at: number;
}

export interface NotificationConfigRow {
  id: number;
  batch_window_minutes: number;
  min_alerts_to_send: number;
  max_batch_size: number;
  cooldown_minutes: number;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  enabled: number;
  updated_at: number;
}

// ── API Response Types ──

export interface MarketState {
  ticker: string;
  label: string;
  trend: string;
  lastBos: number | null;
  lastChoch: number | null;
  lastEventAt: number | null;
  chartUrl: string;
}

export interface StatsResponse {
  totalBos: number;
  totalChoch: number;
  bullishEvents: number;
  bearishEvents: number;
  emailsSent: number;
  pendingAlerts: number;
}

// ── V4: Opportunity Engine ──

export interface OpportunityRow {
  id: number;
  symbol_id: number;
  direction: string;
  workflow_type: 'reversal' | 'continuation';
  watch_level: number;
  status: 'active' | 'notified' | 'expired';
  choch_event_id: number | null;
  bos_event_id: number | null;
  impulse_high: number | null;
  impulse_low: number | null;
  fib_0: number | null;
  fib_50: number | null;
  fib_100: number | null;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  risk_reward: number | null;
  created_at: number;
  updated_at: number;
  notified_at: number | null;
}

export interface OpportunityWithTicker extends OpportunityRow {
  ticker: string;
}

export interface OpportunityScore {
  externalStructure: number;   // 0-20
  chochValid: number;          // 0-15
  bosConfirmation: number;     // 0-20
  fibRetracement: number;      // 0-25
  marketQuality: number;       // 0-10
  timeframeIntegrity: number;  // 0-10
  total: number;               // 0-100
  deductions: string[];
}

// ── V5: Continuation Engine Types ──

export type Direction = 'bullish' | 'bearish';
export type Bias = Direction | 'neutral';

export interface SwingPoint {
  index: number;            // index in the candle buffer at time of detection
  time: number;
  price: number;
  type: 'high' | 'low';
}

export interface Leg {
  direction: Direction;
  originPrice: number;      // the swing that will become SL (0%)
  originTime: number;
  extremePrice: number;     // the swing that just got broken (100%)
  extremeTime: number;
}

export interface FibLevels {
  entry: number;             // 50%
  stop: number;               // 0% (leg origin)
  target: number;             // 100% (leg extreme)
  rr: number;                 // sanity-check, should always compute to 1
}

export interface StructureEvent {
  symbol: string;
  timeframe: string;
  type: 'BOS' | 'CHOCH';
  direction: Direction;
  price: number;              // the level that was broken
  time: number;
  leg: Leg;                   // the leg this break defines
}

export type ContinuationStage =
  | 'IDLE'          // no active bias-aligned setup
  | 'CHOCH_WARN'     // CHoCH seen, watching for confirming BOS
  | 'ARMED'          // BOS confirmed, leg + fib set, waiting for 50% retrace
  | 'IN_TRADE';      // entry filled, waiting for TP or SL

export interface ActiveTrade {
  symbol: string;
  direction: Direction;
  entry: number;
  stop: number;
  target: number;
  entryTime: number;
  chainCount: number;        // how many continuation trades deep in this run
}

export interface ContinuationState {
  symbol: string;
  timeframe: string;
  stage: ContinuationStage;
  bias: Bias;
  leg: Leg | null;
  fib: FibLevels | null;
  trade: ActiveTrade | null;
  confirmCount: number;       // consecutive candles confirming a chain-continuation BOS
  lastSwingHigh: SwingPoint | null;
  lastSwingLow: SwingPoint | null;
  highBroken: boolean;
  lowBroken: boolean;
}

export type EngineAction =
  | { kind: 'CHOCH_WARNING'; event: StructureEvent }
  | { kind: 'LEG_ARMED'; event: StructureEvent; fib: FibLevels }
  | { kind: 'TRADE_ENTERED'; trade: ActiveTrade }
  | { kind: 'TARGET_HIT'; trade: ActiveTrade; price: number; time: number }
  | { kind: 'STOP_HIT'; trade: ActiveTrade; price: number; time: number };
