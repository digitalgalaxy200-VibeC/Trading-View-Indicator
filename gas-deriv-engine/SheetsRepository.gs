// ============================================================
// SheetsRepository.gs — Google Sheets Data Storage
// AI Trend Assistant — Deriv Engine
// ============================================================

/**
 * Handles all interactions with the Trading Journal Google Sheet.
 */
class SheetsRepository {
  
  constructor() {
    this.ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    this.sheet = this.ss.getSheetByName(CONFIG.JOURNAL_SHEET_NAME);
    
    if (!this.sheet) {
      this.sheet = this.ss.insertSheet(CONFIG.JOURNAL_SHEET_NAME);
      this._initializeHeaders();
    }
  }

  _initializeHeaders() {
    const headers = [
      'Date', 'Time', 'Symbol', 'Timeframe', 'Event', 
      'Direction', 'Price', 'AI Summary', 'Event ID'
    ];
    
    this.sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight('bold')
      .setBackground('#0f1729')
      .setFontColor('#ffffff');
      
    this.sheet.setFrozenRows(1);
    this.sheet.setColumnWidth(COLS.AI_SUMMARY, 400);
    this.sheet.getRange(1, COLS.AI_SUMMARY, 1000, 1).setWrap(true);
    
    // Hide the Event ID column (column 9)
    this.sheet.hideColumns(9);
  }

  /**
   * Checks if an event ID has already been logged to prevent duplicates.
   * @param {string} eventId 
   * @returns {boolean} True if duplicate
   */
  isDuplicateEvent(eventId) {
    const lastRow = this.sheet.getLastRow();
    if (lastRow < 2) return false;
    
    // Read the last 20 event IDs (column 9) for quick deduplication check
    const startRow = Math.max(2, lastRow - 20);
    const numRows = lastRow - startRow + 1;
    const ids = this.sheet.getRange(startRow, 9, numRows, 1).getValues().flat();
    
    return ids.includes(eventId);
  }

  /**
   * Saves a new event to the Google Sheet.
   * @param {Object} event The detected event
   * @param {string} aiAnalysis The AI commentary
   */
  logEvent(event, aiAnalysis) {
    const nextRow = this.sheet.getLastRow() + 1;
    const eventTime = new Date(event.epoch * 1000); // Deriv epoch is in seconds
    
    this.sheet.getRange(nextRow, COLS.DATE).setValue(eventTime).setNumberFormat('dd/MM/yyyy');
    this.sheet.getRange(nextRow, COLS.TIME).setValue(eventTime).setNumberFormat('HH:mm:ss');
    this.sheet.getRange(nextRow, COLS.SYMBOL).setValue(CONFIG.SYMBOL);
    this.sheet.getRange(nextRow, COLS.TIMEFRAME).setValue(`${CONFIG.TIMEFRAME}s`);
    this.sheet.getRange(nextRow, COLS.EVENT).setValue(event.event);
    
    const dirCell = this.sheet.getRange(nextRow, COLS.DIRECTION);
    dirCell.setValue(event.direction).setFontWeight('bold');
    if (event.direction === 'BULLISH') dirCell.setFontColor('#089981');
    else dirCell.setFontColor('#F23645');
    
    this.sheet.getRange(nextRow, COLS.PRICE).setValue(event.price).setNumberFormat('#,##0.00');
    this.sheet.getRange(nextRow, COLS.AI_SUMMARY).setValue(aiAnalysis);
    
    // Column 9 is Event ID
    this.sheet.getRange(nextRow, 9).setValue(event.id);

    // Apply alternating row colour
    const rowColor = nextRow % 2 === 0 ? '#1e2330' : '#252d3d';
    this.sheet.getRange(nextRow, 1, 1, 9).setBackground(rowColor);
  }
}
