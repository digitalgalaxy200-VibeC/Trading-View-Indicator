import { FibLevels, StructureEvent } from '../types';

export interface StructureAlert {
  symbol: string;
  direction: 'bullish' | 'bearish';
  subject: string;
  message: string;
  bosPrice: number;
  bosTime: number;
  entry: number;
  stop: number;
  target: number;
  rr: number;
}

export function buildStructureAlert(event: StructureEvent, fib: FibLevels): StructureAlert {
  const dirLabel = event.direction === 'bullish' ? 'Bullish' : 'Bearish';
  const orderType = event.direction === 'bullish' ? 'Buy Limit' : 'Sell Limit';
  const bosTimeStr = new Date(event.time).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

  const subject = `${event.symbol} — ${dirLabel} BOS, entry near ${fib.entry.toFixed(2)}`;

  const message =
    `${dirLabel} break of structure on ${event.symbol}.\n` +
    `Broke at ${event.price.toFixed(2)} — ${bosTimeStr}.\n\n` +
    `Possible entry: up to the 50% level at ${fib.entry.toFixed(2)}.\n` +
    `Reference stop: ${fib.stop.toFixed(2)}\n` +
    `Reference target: ${fib.target.toFixed(2)} (1R)\n\n` +
    `Setup notice only. Review the chart yourself and place a ${orderType} ` +
    `at the price you're comfortable with — no auto-entry, no auto-stop.`;

  return {
    symbol: event.symbol,
    direction: event.direction,
    subject,
    message,
    bosPrice: event.price,
    bosTime: event.time,
    entry: fib.entry,
    stop: fib.stop,
    target: fib.target,
    rr: fib.rr,
  };
}
