"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BreakoutDetector = void 0;
class BreakoutDetector {
    // We start by assuming a Bullish trend. This will correct itself upon the first breakout.
    currentTrend = 'BULLISH';
    // Track if the active pivot has already been broken to prevent duplicate breakouts
    activeSwingHighCrossed = false;
    activeSwingLowCrossed = false;
    // Keep track of the pivot levels to know when they change
    lastEvaluatedSwingHigh = null;
    lastEvaluatedSwingLow = null;
    evaluateBreakouts(candle, activeSwingHigh, activeSwingLow) {
        // If the SwingDetector has confirmed a NEW pivot, we reset our 'crossed' flags
        if (activeSwingHigh !== this.lastEvaluatedSwingHigh) {
            this.activeSwingHighCrossed = false;
            this.lastEvaluatedSwingHigh = activeSwingHigh;
        }
        if (activeSwingLow !== this.lastEvaluatedSwingLow) {
            this.activeSwingLowCrossed = false;
            this.lastEvaluatedSwingLow = activeSwingLow;
        }
        const close = candle.close;
        const trendBefore = this.currentTrend;
        // ── Bullish Breakout ──
        if (activeSwingHigh !== null && !this.activeSwingHighCrossed && close > activeSwingHigh) {
            this.activeSwingHighCrossed = true;
            const isChoch = (this.currentTrend === 'BEARISH');
            this.currentTrend = 'BULLISH';
            return {
                id: `${isChoch ? 'Bullish CHoCH' : 'Bullish BOS'}_${candle.epoch}_${close}`,
                event: isChoch ? 'Bullish CHoCH' : 'Bullish BOS',
                direction: 'BULLISH',
                price: close,
                trendBefore: trendBefore,
                trendAfter: 'BULLISH',
                pivotLevel: activeSwingHigh,
                previousSwingPrice: activeSwingLow || activeSwingHigh,
                distanceFromPivot: Math.abs(close - activeSwingHigh),
                epoch: candle.epoch
            };
        }
        // ── Bearish Breakout ──
        if (activeSwingLow !== null && !this.activeSwingLowCrossed && close < activeSwingLow) {
            this.activeSwingLowCrossed = true;
            const isChoch = (this.currentTrend === 'BULLISH');
            this.currentTrend = 'BEARISH';
            return {
                id: `${isChoch ? 'Bearish CHoCH' : 'Bearish BOS'}_${candle.epoch}_${close}`,
                event: isChoch ? 'Bearish CHoCH' : 'Bearish BOS',
                direction: 'BEARISH',
                price: close,
                trendBefore: trendBefore,
                trendAfter: 'BEARISH',
                pivotLevel: activeSwingLow,
                previousSwingPrice: activeSwingHigh || activeSwingLow,
                distanceFromPivot: Math.abs(close - activeSwingLow),
                epoch: candle.epoch
            };
        }
        return null;
    }
    getCurrentTrend() {
        return this.currentTrend;
    }
}
exports.BreakoutDetector = BreakoutDetector;
