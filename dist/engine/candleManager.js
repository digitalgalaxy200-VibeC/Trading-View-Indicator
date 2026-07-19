"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CandleManager = void 0;
const structureEngine_1 = require("./structureEngine");
class CandleManager {
    candles = [];
    engine;
    onEvent;
    initialized = false;
    constructor(onEvent, state) {
        this.onEvent = onEvent;
        this.engine = new structureEngine_1.StructureEngine(state || (0, structureEngine_1.createInitialStructureState)());
    }
    getState() {
        return this.engine.getState();
    }
    initializeHistory(historicalCandles) {
        this.candles = historicalCandles.sort((a, b) => a.epoch - b.epoch);
        this.initialized = true;
        console.log(`  CandleManager: loaded ${this.candles.length} historical candles.`);
        // Silently process history to hydrate structural state — no events emitted
        this.engine.process(this.candles);
    }
    onNewCandleClosed(candle) {
        if (!this.initialized)
            return;
        this.candles.push(candle);
        // Keep only the last 300 candles to bound memory
        // (we need more than old engine since 3-bar pivot needs neighbours)
        if (this.candles.length > 300) {
            this.candles = this.candles.slice(-300);
        }
        const events = this.engine.process(this.candles);
        for (const event of events) {
            this.onEvent(event);
        }
    }
}
exports.CandleManager = CandleManager;
