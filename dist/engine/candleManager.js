"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CandleManager = void 0;
const pivotDetector_1 = require("./pivotDetector");
class CandleManager {
    candles = [];
    detector;
    onEvent;
    initialized = false;
    constructor(onEvent, state) {
        this.onEvent = onEvent;
        this.detector = new pivotDetector_1.PivotDetector(state || (0, pivotDetector_1.createInitialPivotState)());
    }
    getState() {
        return this.detector.getState();
    }
    initializeHistory(historicalCandles) {
        this.candles = historicalCandles.sort((a, b) => a.epoch - b.epoch);
        this.initialized = true;
        console.log(`  CandleManager: loaded ${this.candles.length} historical candles.`);
        // Process historical candles to rebuild pivot state (but don't emit events for old data)
        this.detector.process(this.candles);
    }
    onNewCandleClosed(candle) {
        if (!this.initialized)
            return;
        this.candles.push(candle);
        // Keep only the last 200 candles to bound memory
        if (this.candles.length > 200) {
            this.candles = this.candles.slice(-200);
        }
        const events = this.detector.process(this.candles);
        for (const event of events) {
            this.onEvent(event);
        }
    }
}
exports.CandleManager = CandleManager;
