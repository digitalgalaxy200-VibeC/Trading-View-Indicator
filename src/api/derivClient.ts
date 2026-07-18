import WebSocket from 'ws';
import { config } from '../config/env';
import { Candle } from '../types';

type HistoryCallback = (symbol: string, candles: Candle[]) => void;
type CandleCallback = (symbol: string, candle: Candle) => void;

export class DerivClient {
  private ws: WebSocket | null = null;
  private historyCb: HistoryCallback | null = null;
  private candleCb: CandleCallback | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;

  // Track the current open candle per symbol. We only emit when the epoch changes.
  private currentCandles = new Map<string, Candle>();

  onHistory(cb: HistoryCallback): void { this.historyCb = cb; }
  onCandleClosed(cb: CandleCallback): void { this.candleCb = cb; }

  connect(): void {
    console.log(`Connecting to Deriv WebSocket...`);
    this.ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');

    this.ws.on('open', () => {
      console.log('Deriv WebSocket connected.');
      this.reconnectDelay = 1000;

      // Subscribe to ticks_history for each symbol
      for (const symbol of config.symbols) {
        this.ws!.send(JSON.stringify({
          ticks_history: symbol,
          style: 'candles',
          granularity: config.timeframe,
          count: config.pivotLength + 10, // enough candles to detect pivots
          end: 'latest',
          subscribe: 1,
        }));
      }
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleMessage(msg);
      } catch (e) {
        // ignore malformed messages
      }
    });

    this.ws.on('close', () => {
      console.log(`Deriv WebSocket closed. Reconnecting in ${this.reconnectDelay}ms...`);
      setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    });

    this.ws.on('error', (err) => {
      console.error('Deriv WebSocket error:', err.message);
    });
  }

  private handleMessage(msg: any): void {
    if (msg.error) {
      console.error('Deriv API error:', msg.error.message);
      return;
    }

    // Historical candles response
    if (msg.candles && msg.msg_type === 'candles') {
      const symbol = msg.echo_req?.ticks_history;
      if (symbol && this.historyCb) {
        const candles: Candle[] = msg.candles.map((c: any) => ({
          epoch: parseInt(c.epoch, 10),
          open: parseFloat(c.open),
          high: parseFloat(c.high),
          low: parseFloat(c.low),
          close: parseFloat(c.close),
        }));
        this.historyCb(symbol, candles);
      }
    }

    // Streaming candle (ohlc) — sent continuously on every tick
    if (msg.ohlc && msg.msg_type === 'ohlc') {
      const symbol = msg.echo_req?.ticks_history;
      if (symbol && this.candleCb) {
        const currentEpoch = parseInt(msg.ohlc.epoch, 10);
        
        const tickCandle: Candle = {
          epoch: currentEpoch,
          open: parseFloat(msg.ohlc.open),
          high: parseFloat(msg.ohlc.high),
          low: parseFloat(msg.ohlc.low),
          close: parseFloat(msg.ohlc.close),
        };

        const existingCandle = this.currentCandles.get(symbol);

        // If we have an existing candle and the epoch has moved forward,
        // it means the existing candle has officially closed!
        if (existingCandle && existingCandle.epoch < currentEpoch) {
          this.candleCb(symbol, existingCandle);
        }

        // Always update the buffer with the latest tick for the current epoch
        this.currentCandles.set(symbol, tickCandle);
      }
    }
  }
}
