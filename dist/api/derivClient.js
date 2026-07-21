"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DerivClient = void 0;
const ws_1 = __importDefault(require("ws"));
const env_1 = require("../config/env");
class DerivClient {
    ws = null;
    historyCb = null;
    candleCb = null;
    reconnectDelay = 1000;
    maxReconnectDelay = 30000;
    // Track current candle by `symbol_timeframe` key
    currentCandles = new Map();
    onHistory(cb) { this.historyCb = cb; }
    onCandleClosed(cb) { this.candleCb = cb; }
    connect() {
        console.log(`Connecting to Deriv WebSocket...`);
        this.ws = new ws_1.default('wss://ws.binaryws.com/websockets/v3?app_id=1089');
        this.ws.on('open', () => {
            console.log('Deriv WebSocket connected.');
            this.reconnectDelay = 1000;
            for (const symbol of env_1.config.symbols) {
                // Subscribe to 15m (900)
                this.ws.send(JSON.stringify({
                    ticks_history: symbol,
                    style: 'candles',
                    granularity: 900,
                    count: 300,
                    end: 'latest',
                    subscribe: 1,
                }));
                // Subscribe to 5m (300)
                this.ws.send(JSON.stringify({
                    ticks_history: symbol,
                    style: 'candles',
                    granularity: 300,
                    count: 300,
                    end: 'latest',
                    subscribe: 1,
                }));
            }
        });
        this.ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                this.handleMessage(msg);
            }
            catch (e) {
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
    handleMessage(msg) {
        if (msg.error) {
            console.error(`Deriv API Error:`, msg.error.message);
            return;
        }
        // Historical data
        if (msg.msg_type === 'candles') {
            const symbol = msg.echo_req.ticks_history;
            const tfNumeric = msg.echo_req.granularity;
            const timeframe = tfNumeric === 900 ? '15m' : '5m';
            const candles = msg.candles.map((c) => ({
                symbol,
                timeframe,
                time: c.epoch * 1000,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
            }));
            // The last candle in the history array is the current incomplete candle.
            // We pop it off to seed our live tracking, and pass the rest as confirmed history.
            const incompleteCandle = candles.pop();
            if (incompleteCandle) {
                this.currentCandles.set(`${symbol}_${timeframe}`, incompleteCandle);
            }
            if (this.historyCb) {
                this.historyCb(symbol, timeframe, candles);
            }
        }
        // Live streaming candle update
        if (msg.msg_type === 'ohlc') {
            const symbol = msg.ohlc.symbol;
            const tfNumeric = msg.ohlc.granularity;
            const timeframe = tfNumeric === 900 ? '15m' : '5m';
            const key = `${symbol}_${timeframe}`;
            const ohlc = msg.ohlc;
            const liveCandle = {
                symbol,
                timeframe,
                time: ohlc.open_time * 1000,
                open: parseFloat(ohlc.open),
                high: parseFloat(ohlc.high),
                low: parseFloat(ohlc.low),
                close: parseFloat(ohlc.close),
            };
            const tracked = this.currentCandles.get(key);
            if (tracked && tracked.time < liveCandle.time) {
                // A new candle period has started, which means 'tracked' has officially closed.
                if (this.candleCb) {
                    this.candleCb(symbol, timeframe, tracked);
                }
                // Start tracking the new candle
                this.currentCandles.set(key, liveCandle);
            }
            else {
                // Update the current tracked candle with the latest live data
                this.currentCandles.set(key, liveCandle);
            }
        }
    }
}
exports.DerivClient = DerivClient;
