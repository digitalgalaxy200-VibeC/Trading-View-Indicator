/**
 * Maps Deriv API tickers to their correct TradingView symbol format.
 * TradingView resolves these without any exchange prefix.
 */
const DERIV_TV_MAP: Record<string, string> = {
  // Standard Volatility Indices
  'R_100':   'VOLATILITY_100_INDEX',
  'R_75':    'VOLATILITY_75_INDEX',
  'R_50':    'VOLATILITY_50_INDEX',
  'R_25':    'VOLATILITY_25_INDEX',
  'R_10':    'VOLATILITY_10_INDEX',

  // 1-Second Volatility Indices
  '1HZ100V': 'VOLATILITY_100_1S_INDEX',
  '1HZ75V':  'VOLATILITY_75_1S_INDEX',
  '1HZ50V':  'VOLATILITY_50_1S_INDEX',
  '1HZ30V':  'VOLATILITY_30_1S_INDEX',
  '1HZ25V':  'VOLATILITY_25_1S_INDEX',
  '1HZ15V':  'VOLATILITY_15_1S_INDEX',
  '1HZ10V':  'VOLATILITY_10_1S_INDEX',
};

export function getTradingViewUrl(ticker: string): string {
  const tvSymbol = DERIV_TV_MAP[ticker];
  if (!tvSymbol) return 'https://www.tradingview.com/chart/';
  return `https://www.tradingview.com/chart/?symbol=${tvSymbol}`;
}
