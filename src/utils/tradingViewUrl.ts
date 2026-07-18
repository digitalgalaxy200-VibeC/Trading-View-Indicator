import { config } from '../config/env';

const DERIV_TV_MAP: Record<string, string> = {
  'R_100':     'SYNTH:R_100',
  'R_75':      'SYNTH:R_75',
  'R_50':      'SYNTH:R_50',
  'R_25':      'SYNTH:R_25',
  'R_10':      'SYNTH:R_10',
  '1HZ100V':   'SYNTH:1HZ100V',
  '1HZ75V':    'SYNTH:1HZ75V',
  '1HZ50V':    'SYNTH:1HZ50V',
  'BOOM1000':  'SYNTH:BOOM1000',
  'BOOM500':   'SYNTH:BOOM500',
  'CRASH1000': 'SYNTH:CRASH1000',
  'CRASH500':  'SYNTH:CRASH500',
};

export function getTradingViewUrl(ticker: string): string {
  const tvSymbol = DERIV_TV_MAP[ticker] || ticker;
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`;
}
