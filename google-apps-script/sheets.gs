// ============================================================
// sheets.gs — All Google Sheets read / write operations
// AI Trend Assistant V1
// ============================================================

/**
 * Returns a sheet by name, creating it with headers if it does not exist.
 * @param {string} sheetName
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOrCreateSheet(sheetName) {
  const ss    = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let   sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (sheetName === CONFIG.JOURNAL_SHEET_NAME) {
      _setupJournalSheet(sheet);
    } else if (sheetName === CONFIG.LOGS_SHEET_NAME) {
      _setupLogsSheet(sheet);
    }
  }

  return sheet;
}

/**
 * Checks whether an email (by Gmail message ID) has already been processed.
 * Prevents duplicate rows on repeated trigger executions.
 *
 * @param {string} emailId
 * @returns {boolean}
 */
function isEmailAlreadyProcessed(emailId) {
  const sheet   = getOrCreateSheet(CONFIG.JOURNAL_SHEET_NAME);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return false;

  const ids = sheet
    .getRange(2, COLS.EMAIL_ID, lastRow - 1, 1)
    .getValues()
    .flat();

  return ids.includes(emailId);
}

/**
 * Writes a new alert row to the Trading Journal sheet.
 * Returns the row number so AI summary can be written to the same row later.
 *
 * @param {Object} payload — parsed email payload from gmail.gs
 * @returns {number} rowNumber
 */
function writeAlertRow(payload) {
  const sheet      = getOrCreateSheet(CONFIG.JOURNAL_SHEET_NAME);
  const nextRow    = sheet.getLastRow() + 1;
  const alertTime  = payload.timestamp instanceof Date ? payload.timestamp : new Date();
  const chartLink  = _buildChartLink(payload.symbol, payload.timeframe);

  // Write each column individually for clear control
  sheet.getRange(nextRow, COLS.DATE)
    .setValue(alertTime)
    .setNumberFormat('dd/MM/yyyy');

  sheet.getRange(nextRow, COLS.TIME)
    .setValue(alertTime)
    .setNumberFormat('HH:mm:ss');

  sheet.getRange(nextRow, COLS.SYMBOL)
    .setValue(payload.symbol);

  sheet.getRange(nextRow, COLS.TIMEFRAME)
    .setValue(payload.timeframe + 'm');

  sheet.getRange(nextRow, COLS.EVENT)
    .setValue(payload.event);

  sheet.getRange(nextRow, COLS.DIRECTION)
    .setValue(payload.direction);

  sheet.getRange(nextRow, COLS.PRICE)
    .setValue(payload.price)
    .setNumberFormat('#,##0.00');

  sheet.getRange(nextRow, COLS.AI_SUMMARY)
    .setValue('⏳ Analysing...');

  sheet.getRange(nextRow, COLS.CHART_LINK)
    .setFormula(`=HYPERLINK("${chartLink}","📈 Open Chart")`);

  sheet.getRange(nextRow, COLS.REVIEWED)
    .setValue('No');

  sheet.getRange(nextRow, COLS.TRADE_TAKEN)
    .setValue('No');

  sheet.getRange(nextRow, COLS.NOTES)
    .setValue('');

  sheet.getRange(nextRow, COLS.STATUS)
    .setValue('Pending');

  sheet.getRange(nextRow, COLS.EMAIL_ID)
    .setValue(payload.id);

  // Apply alternating row colour for readability
  const rowColor = nextRow % 2 === 0 ? '#1e2330' : '#252d3d';
  sheet.getRange(nextRow, 1, 1, Object.keys(COLS).length).setBackground(rowColor);

  // Colour-code direction cell
  const dirCell = sheet.getRange(nextRow, COLS.DIRECTION);
  if (payload.direction === 'BULLISH') {
    dirCell.setFontColor('#089981').setFontWeight('bold');
  } else {
    dirCell.setFontColor('#F23645').setFontWeight('bold');
  }

  console.log(`writeAlertRow: wrote row ${nextRow} for ${payload.symbol} ${payload.event}`);
  return nextRow;
}

/**
 * Updates the AI Summary and Status columns for an existing row.
 *
 * @param {number} rowNumber
 * @param {string} summary
 * @param {string} status  — 'Processed' | 'AI Error' | 'Parse Error'
 */
function updateAiSummary(rowNumber, summary, status) {
  const sheet = getOrCreateSheet(CONFIG.JOURNAL_SHEET_NAME);
  sheet.getRange(rowNumber, COLS.AI_SUMMARY).setValue(summary);
  sheet.getRange(rowNumber, COLS.STATUS).setValue(status || 'Processed');
}

/**
 * Writes an entry to the Raw Logs sheet for debugging failed emails.
 *
 * @param {string} subject
 * @param {string} rawBody
 * @param {string} error
 */
function writeErrorLog(subject, rawBody, error) {
  const sheet   = getOrCreateSheet(CONFIG.LOGS_SHEET_NAME);
  const nextRow = sheet.getLastRow() + 1;

  sheet.getRange(nextRow, LOG_COLS.PROCESSED_AT).setValue(new Date());
  sheet.getRange(nextRow, LOG_COLS.EMAIL_SUBJECT).setValue(subject || '(no subject)');
  sheet.getRange(nextRow, LOG_COLS.RAW_BODY).setValue((rawBody || '').substring(0, 5000));
  sheet.getRange(nextRow, LOG_COLS.ERROR).setValue(error || '');
}

// ── Private helpers ──────────────────────────────────────────────────────────

function _buildChartLink(symbol, timeframe) {
  return 'https://www.tradingview.com/chart/?symbol='
    + encodeURIComponent(symbol)
    + '&interval=' + encodeURIComponent(timeframe);
}

function _setupJournalSheet(sheet) {
  // Headers
  sheet.getRange(1, 1, 1, JOURNAL_HEADERS.length)
    .setValues([JOURNAL_HEADERS])
    .setFontWeight('bold')
    .setBackground('#0f1729')
    .setFontColor('#ffffff');

  sheet.setFrozenRows(1);

  // Column widths
  const widths = {
    [COLS.DATE]:         100,
    [COLS.TIME]:         80,
    [COLS.SYMBOL]:       180,
    [COLS.TIMEFRAME]:    85,
    [COLS.EVENT]:        150,
    [COLS.DIRECTION]:    100,
    [COLS.PRICE]:        100,
    [COLS.AI_SUMMARY]:   400,
    [COLS.CHART_LINK]:   110,
    [COLS.REVIEWED]:     90,
    [COLS.TRADE_TAKEN]:  100,
    [COLS.NOTES]:        250,
    [COLS.STATUS]:       90,
    [COLS.EMAIL_ID]:     180,
  };
  Object.entries(widths).forEach(([col, width]) => {
    sheet.setColumnWidth(parseInt(col), width);
  });

  // Hide system columns (Status, Email ID)
  sheet.hideColumns(COLS.STATUS, 2);

  // Dropdown validation for Reviewed and Trade Taken
  const yesNoRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Yes', 'No'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, COLS.REVIEWED,    1000, 1).setDataValidation(yesNoRule);
  sheet.getRange(2, COLS.TRADE_TAKEN, 1000, 1).setDataValidation(yesNoRule);

  // Wrap AI Summary column
  sheet.getRange(1, COLS.AI_SUMMARY, 1001, 1).setWrap(true);

  console.log('_setupJournalSheet: Trading Journal sheet initialised.');
}

function _setupLogsSheet(sheet) {
  sheet.getRange(1, 1, 1, LOGS_HEADERS.length)
    .setValues([LOGS_HEADERS])
    .setFontWeight('bold')
    .setBackground('#2d1515')
    .setFontColor('#ffffff');

  sheet.setFrozenRows(1);
  sheet.setColumnWidth(LOG_COLS.RAW_BODY, 500);
  sheet.setColumnWidth(LOG_COLS.ERROR,    300);
  sheet.getRange(1, LOG_COLS.RAW_BODY, 1001, 1).setWrap(true);

  console.log('_setupLogsSheet: Raw Logs sheet initialised.');
}
