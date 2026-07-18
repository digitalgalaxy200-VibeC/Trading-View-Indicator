/**
 * Maps Deriv API tickers to their correct TradingView symbol format.
 * TradingView uses DERIV:VOLATILITY_XX_INDEX for standard pairs
 * and DERIV:VOLATILITY_XX_1S_INDEX for 1-second pairs.
 */
const DERIV_TV_MAP: Record<string, string> = {
  // Standard Volatility Indices
  'R_100':   'DERIV:VOLATILITY_100_INDEX',
  'R_75':    'DERIV:VOLATILITY_75_INDEX',
  'R_50':    'DERIV:VOLATILITY_50_INDEX',
  'R_25':    'DERIV:VOLATILITY_25_INDEX',
  'R_10':    'DERIV:VOLATILITY_10_INDEX',

  // 1-Second Volatility Indices
  '1HZ100V': 'DERIV:VOLATILITY_100_1S_INDEX',
  '1HZ75V':  'DERIV:VOLATILITY_75_1S_INDEX',
  '1HZ50V':  'DERIV:VOLATILITY_50_1S_INDEX',
  '1HZ30V':  'DERIV:VOLATILITY_30_1S_INDEX',
  '1HZ25V':  'DERIV:VOLATILITY_25_1S_INDEX',
  '1HZ15V':  'DERIV:VOLATILITY_15_1S_INDEX',
  '1HZ10V':  'DERIV:VOLATILITY_10_1S_INDEX',
};

export function getTradingViewUrl(ticker: string): string {
  const tvSymbol = DERIV_TV_MAP[ticker];
  if (!tvSymbol) {
    // Fallback: open TradingView search for unknown symbols
    return `https://www.tradingview.com/chart/`;
  }
  return `https://www.tradingview.com/chart/?symbol=${tvSymbol}`;
}
