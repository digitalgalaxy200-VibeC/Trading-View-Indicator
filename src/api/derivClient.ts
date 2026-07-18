import WebSocket from 'ws';
import { config } from '../config/env';
import { Candle } from '../types';

type CandleUpdateCallback = (symbol: string, historicalCandles: Candle[]) => void;
type NewCandleClosedCallback = (symbol: string, closedCandle: Candle) => void;

export class DerivClient {
  private ws: WebSocket | null = null;
  private currentEpochs: Map<string, number> = new Map();
  private latestCandles: Map<string, Candle> = new Map();
  
  private onHistoryCallback: CandleUpdateCallback | null = null;
  private onClosedCallback: NewCandleClosedCallback | null = null;

  public onHistory(callback: CandleUpdateCallback) {
    this.onHistoryCallback = callback;
  }

  public onCandleClosed(callback: NewCandleClosedCallback) {
    this.onClosedCallback = callback;
  }

  public connect() {
    const wsUrl = `${config.derivWsUrl}?app_id=${config.derivAppId}`;
    console.log(`Connecting to Deriv WebSocket: ${wsUrl}...`);
    
    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      console.log('Connected to Deriv.');
      this.subscribeToCandles();
    });

    this.ws.on('message', (data: string) => {
      const response = JSON.parse(data);
      this.handleMessage(response);
    });

    this.ws.on('close', () => {
      console.warn('Deriv WebSocket closed. Reconnecting in 5 seconds...');
      setTimeout(() => this.connect(), 5000);
    });

    this.ws.on('error', (err) => {
      console.error('Deriv WebSocket Error:', err.message);
    });
  }

  private subscribeToCandles() {
    if (!this.ws) return;
    
    for (const symbol of config.symbols) {
      const request = {
        ticks_history: symbol,
        style: 'candles',
        granularity: config.timeframe,
        count: 200, // Fetch the last 200 candles to build the initial structure state
        end: 'latest',
        subscribe: 1
      };

      console.log(`Subscribing to candles for ${symbol} (TF: ${config.timeframe}s)...`);
      this.ws.send(JSON.stringify(request));
    }
  }

  private handleMessage(response: any) {
    if (response.error) {
      console.error('Deriv API Error:', response.error.message);
      return;
    }

    // 1. Initial historical candles response
    if (response.msg_type === 'history' && response.candles) {
      const symbol = response.echo_req.ticks_history;
      const history: Candle[] = response.candles.map((c: any) => ({
        epoch: c.epoch,
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close)
      }));

      // The last candle in history is usually the currently forming (open) candle.
      // We will treat it as our tracked current candle.
      const latest = history.pop() || null;
      if (latest) {
        this.latestCandles.set(symbol, latest);
        this.currentEpochs.set(symbol, latest.epoch);
      }

      console.log(`[${symbol}] Loaded ${history.length} historical closed candles.`);
      if (this.onHistoryCallback) {
        this.onHistoryCallback(symbol, history);
      }
    }

    // 2. Real-time OHLC stream updates
    if (response.msg_type === 'ohlc' && response.ohlc) {
      const ohlc = response.ohlc;
      const symbol = ohlc.symbol;
      const tickEpoch = ohlc.epoch;
      
      const updatedCandle: Candle = {
        epoch: tickEpoch,
        open: parseFloat(ohlc.open),
        high: parseFloat(ohlc.high),
        low: parseFloat(ohlc.low),
        close: parseFloat(ohlc.close)
      };

      const currentEpoch = this.currentEpochs.get(symbol);
      const latestCandle = this.latestCandles.get(symbol);

      // If the epoch has changed, it means the previous candle has officially closed!
      if (currentEpoch !== undefined && tickEpoch > currentEpoch) {
        if (latestCandle && this.onClosedCallback) {
          this.onClosedCallback(symbol, latestCandle);
        }
      }

      // Update our tracked latest candle for this symbol
      this.currentEpochs.set(symbol, tickEpoch);
      this.latestCandles.set(symbol, updatedCandle);
    }
  }
}
