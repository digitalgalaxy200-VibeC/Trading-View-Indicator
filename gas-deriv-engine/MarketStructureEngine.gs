// ============================================================
// MarketStructureEngine.gs — Core Pivot and BOS/CHOCH Logic
// AI Trend Assistant — Deriv Engine
// ============================================================

const BULLISH = 1;
const BEARISH = 0;

class MarketStructureEngine {

  constructor(stateStore) {
    this.store = stateStore;
    this.state = this.store.loadState();
    
    // Ensure new flags exist if upgrading from older state format
    if (this.state.activeSwingHighCrossed === undefined) {
      this.state.activeSwingHighCrossed = false;
      this.state.activeSwingLowCrossed = false;
    }
  }

  /**
   * Processes an array of recent candles, updating state and returning any new events.
   * @param {Array} candles Array of { epoch, open, high, low, close } sorted chronologically (oldest to newest)
   * @returns {Array} List of detected events
   */
  process(candles) {
    const events = [];
    const pivotLen = CONFIG.PIVOT_LENGTH;

    if (candles.length <= pivotLen) {
      console.warn(`Not enough candles to process. Need > ${pivotLen}, got ${candles.length}.`);
      return events;
    }

    // Iterate over candles that haven't been processed yet.
    // We start at index = pivotLen because we need at least pivotLen historical candles to confirm a pivot.
    for (let i = pivotLen; i < candles.length; i++) {
      const currentCandle = candles[i];
      
      // Skip if we've already processed this candle in a previous trigger execution
      if (currentCandle.epoch <= this.state.lastProcessedEpoch) {
        continue;
      }

      // ── 1. Check for newly confirmed pivots ──────────────────────────────
      // A pivot is the candle `pivotLen` bars ago.
      const pivotIdx = i - pivotLen;
      const potentialPivot = candles[pivotIdx];
      
      // Get the highest high and lowest low of the trailing `pivotLen` window (excluding the pivot itself)
      const windowCandles = candles.slice(pivotIdx + 1, i + 1);
      
      let highestInWindow = -Infinity;
      let lowestInWindow = Infinity;
      
      for (const c of windowCandles) {
        if (c.high > highestInWindow) highestInWindow = c.high;
        if (c.low < lowestInWindow) lowestInWindow = c.low;
      }

      // Confirm Pivot High (Swing High)
      if (potentialPivot.high > highestInWindow) {
        this.state.activeSwingHigh = potentialPivot.high;
        this.state.activeSwingHighCrossed = false;
      }

      // Confirm Pivot Low (Swing Low)
      if (potentialPivot.low < lowestInWindow) {
        this.state.activeSwingLow = potentialPivot.low;
        this.state.activeSwingLowCrossed = false;
      }

      // ── 2. Check for BOS / CHOCH breakouts on current candle close ────────
      const close = currentCandle.close;
      const trendBefore = this.state.currentTrend === BULLISH ? 'BULLISH' : 'BEARISH';
      let eventDetected = null;

      // Bullish Breakout
      if (this.state.activeSwingHigh !== null && !this.state.activeSwingHighCrossed && close > this.state.activeSwingHigh) {
        this.state.activeSwingHighCrossed = true;
        const isChoch = (this.state.currentTrend === BEARISH);
        this.state.currentTrend = BULLISH;
        
        eventDetected = {
          event: isChoch ? 'Bullish CHoCH' : 'Bullish BOS',
          direction: 'BULLISH',
          price: close,
          trendBefore: trendBefore,
          trendAfter: 'BULLISH',
          pivotLevel: this.state.activeSwingHigh,
          epoch: currentCandle.epoch
        };
      }
      
      // Bearish Breakout
      else if (this.state.activeSwingLow !== null && !this.state.activeSwingLowCrossed && close < this.state.activeSwingLow) {
        this.state.activeSwingLowCrossed = true;
        const isChoch = (this.state.currentTrend === BULLISH);
        this.state.currentTrend = BEARISH;
        
        eventDetected = {
          event: isChoch ? 'Bearish CHoCH' : 'Bearish BOS',
          direction: 'BEARISH',
          price: close,
          trendBefore: trendBefore,
          trendAfter: 'BEARISH',
          pivotLevel: this.state.activeSwingLow,
          epoch: currentCandle.epoch
        };
      }

      // Log the event if detected
      if (eventDetected) {
        // Create a unique ID for deduplication: EventType_Epoch_Price
        eventDetected.id = `${eventDetected.event}_${eventDetected.epoch}_${eventDetected.price}`;
        events.push(eventDetected);
      }

      // Mark this candle as processed
      this.state.lastProcessedEpoch = currentCandle.epoch;
    }

    // Save updated state to sheet
    this.store.saveState(this.state);
    
    return events;
  }
}
