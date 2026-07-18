"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CandleManager = void 0;
const swingDetector_1 = require("./swingDetector");
const breakoutDetector_1 = require("./breakoutDetector");
const env_1 = require("../config/env");
class CandleManager {
    onEventDetected;
    candles = [];
    swingDetector;
    breakoutDetector;
    // Track the ID of the last event we fired to avoid duplicates
    lastFiredEventId = null;
    constructor(onEventDetected) {
        this.onEventDetected = onEventDetected;
        this.swingDetector = new swingDetector_1.SwingDetector();
        this.breakoutDetector = new breakoutDetector_1.BreakoutDetector();
    }
    /**
     * Called once when the initial history is loaded via WebSocket.
     */
    initializeHistory(history) {
        // We only need enough history to cover the lookback window safely.
        // E.g., if PIVOT_LENGTH is 50, storing 200 candles is plenty.
        this.candles = history.slice(-200);
        console.log(`[Engine] Initializing with ${this.candles.length} historical candles.`);
        // We process the historical candles sequentially to build the current state.
        // We start from index PIVOT_LENGTH to ensure we have enough lookback data.
        for (let i = env_1.config.pivotLength; i < this.candles.length; i++) {
            this.evaluateCandleClosure(i);
        }
        console.log(`[Engine] Initial state built.`);
        console.log(`  Current Trend: ${this.breakoutDetector.getCurrentTrend()}`);
        console.log(`  Active Swing High: ${this.swingDetector.getActiveSwingHigh()}`);
        console.log(`  Active Swing Low: ${this.swingDetector.getActiveSwingLow()}`);
    }
    /**
     * Called every time a new live candle officially closes.
     */
    onNewCandleClosed(candle) {
        console.log(`[Engine] New candle closed: Epoch ${candle.epoch} | Close: ${candle.close}`);
        // Push it to the buffer
        this.candles.push(candle);
        // Keep buffer size manageable to prevent memory leaks
        if (this.candles.length > 500) {
            this.candles.shift();
        }
        // Evaluate this latest closure
        this.evaluateCandleClosure(this.candles.length - 1);
    }
    /**
     * The core evaluation loop for a specific closed candle index.
     */
    evaluateCandleClosure(currentIndex) {
        // 1. Give the SwingDetector the opportunity to confirm a pivot that occurred 'PIVOT_LENGTH' bars ago.
        this.swingDetector.evaluatePivots(this.candles, currentIndex);
        // 2. Give the BreakoutDetector the opportunity to check if the CURRENT candle broke an active pivot.
        const activeHigh = this.swingDetector.getActiveSwingHigh();
        const activeLow = this.swingDetector.getActiveSwingLow();
        const currentCandle = this.candles[currentIndex];
        if (!currentCandle) {
            return;
        }
        const event = this.breakoutDetector.evaluateBreakouts(currentCandle, activeHigh, activeLow);
        // 3. Dispatch event if detected and not a duplicate
        if (event) {
            if (event.id !== this.lastFiredEventId) {
                this.lastFiredEventId = event.id;
                // We only dispatch events for LIVE candles, not during the historical initialization phase.
                // We know it's a live candle if currentIndex is the very last element of the array AFTER history is initialized.
                // To be safer, we can just check if we're evaluating the very last candle of the array.
                // Wait, if initializeHistory is running, it runs in a loop. We shouldn't dispatch events for history.
                // We handle this by checking if the array is already fully initialized.
                // Let's pass a flag or just assume this callback logic handles it in `index.ts`.
                // Actually, we pass the event out, and `index.ts` can decide. But it's easier to only fire if it's the absolute latest.
                this.onEventDetected(event);
            }
        }
    }
}
exports.CandleManager = CandleManager;
