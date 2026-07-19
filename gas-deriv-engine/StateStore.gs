// ============================================================
// StateStore.gs — Persistent State Management
// AI Trend Assistant — Deriv Engine
// ============================================================

/**
 * The StateStore manages the incremental execution state in a hidden sheet.
 * Instead of calculating the entire market structure from scratch every minute,
 * we save the active pivots, trend, and the timestamp of the last processed candle.
 */
class StateStore {
  
  constructor() {
    this.ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    this.sheet = this.ss.getSheetByName(CONFIG.STATE_SHEET_NAME);
    
    // Create the hidden state sheet if it doesn't exist
    if (!this.sheet) {
      this.sheet = this.ss.insertSheet(CONFIG.STATE_SHEET_NAME);
      this.sheet.hideSheet();
      this._initializeSheet();
    }
  }

  /**
   * Initializes the sheet headers if it was just created.
   */
  _initializeSheet() {
    this.sheet.getRange('A1:B1').setValues([['Key', 'Value']]).setFontWeight('bold');
    
    // Default initial state
    const defaultState = {
      lastProcessedEpoch: 0,
      currentTrend: 1, // 1 = Bullish, 0 = Bearish
      activeSwingHigh: null,
      activeSwingLow: null,
      lastBOSId: null, // Used for deduplication
      lastCHOCHId: null // Used for deduplication
    };
    
    this.saveState(defaultState);
  }

  /**
   * Loads the current state from the sheet.
   * @returns {Object} The state object
   */
  loadState() {
    const jsonStr = this.sheet.getRange('B2').getValue();
    if (!jsonStr) {
      return {
        lastProcessedEpoch: 0,
        currentTrend: 1,
        activeSwingHigh: null,
        activeSwingLow: null,
        lastBOSId: null,
        lastCHOCHId: null
      };
    }
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse state from sheet. Resetting to default.");
      return {
        lastProcessedEpoch: 0,
        currentTrend: 1,
        activeSwingHigh: null,
        activeSwingLow: null,
        lastBOSId: null,
        lastCHOCHId: null
      };
    }
  }

  /**
   * Saves the state object as a JSON string into the sheet.
   * @param {Object} stateObj 
   */
  saveState(stateObj) {
    this.sheet.getRange('A2').setValue('engineState');
    this.sheet.getRange('B2').setValue(JSON.stringify(stateObj));
  }
}
