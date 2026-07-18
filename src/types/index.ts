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
  epoch: number;   // Unix seconds
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
