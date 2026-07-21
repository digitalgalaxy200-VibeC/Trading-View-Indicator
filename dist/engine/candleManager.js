"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CandleManager = void 0;
const structureEngine_1 = require("./structureEngine");
class CandleManager {
    candles15m = [];
    candles5m = [];
    state15m;
    state5m;
    pivotLen;
    constructor(symbol, pivotLen) {
        this.pivotLen = pivotLen;
        this.state15m = (0, structureEngine_1.createStructureState)(symbol, '15m');
        this.state5m = (0, structureEngine_1.createStructureState)(symbol, '5m');
    }
    getHtfState() {
        return this.state15m;
    }
    getLtfState() {
        return this.state5m;
    }
    initializeHistory(timeframe, historicalCandles) {
        const sorted = historicalCandles.sort((a, b) => a.time - b.time);
        if (timeframe === '15m') {
            this.candles15m = sorted;
            // Replay history
            for (let i = this.pivotLen + 1; i <= this.candles15m.length; i++) {
                const slice = this.candles15m.slice(0, i);
                const { state } = (0, structureEngine_1.updateStructure)(this.state15m, slice, this.pivotLen);
                this.state15m = state;
            }
        }
        else if (timeframe === '5m') {
            this.candles5m = sorted;
            // Replay history
            for (let i = this.pivotLen + 1; i <= this.candles5m.length; i++) {
                const slice = this.candles5m.slice(0, i);
                const { state } = (0, structureEngine_1.updateStructure)(this.state5m, slice, this.pivotLen);
                this.state5m = state;
            }
        }
    }
    onNewCandleClosed(timeframe, candle) {
        if (timeframe === '15m') {
            this.candles15m.push(candle);
            if (this.candles15m.length > 300)
                this.candles15m = this.candles15m.slice(-300);
            const res = (0, structureEngine_1.updateStructure)(this.state15m, this.candles15m, this.pivotLen);
            this.state15m = res.state;
            return res; // We only care about bias from HTF, but returning event is fine
        }
        else if (timeframe === '5m') {
            this.candles5m.push(candle);
            if (this.candles5m.length > 300)
                this.candles5m = this.candles5m.slice(-300);
            const res = (0, structureEngine_1.updateStructure)(this.state5m, this.candles5m, this.pivotLen);
            this.state5m = res.state;
            return res; // LTF event drives continuation Engine
        }
        return null;
    }
}
exports.CandleManager = CandleManager;
