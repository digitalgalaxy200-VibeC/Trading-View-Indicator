// ============================================================
// main.gs — Entry point, orchestration, trigger management
// AI Trend Assistant V1
// ============================================================

/**
 * MAIN ENTRY POINT
 * Called automatically every 5 minutes by the time-driven trigger.
 * Also safe to run manually from the Apps Script editor at any time.
 *
 * Flow:
 *  1. Acquire script lock (prevents overlapping executions)
 *  2. Fetch unread TradingView emails from Gmail
 *  3. For each email: parse → deduplicate → write to Sheets → AI analysis
 *  4. Release lock
 */
function processNewAlerts() {

  // ── Concurrency guard ────────────────────────────────────────────────────
  // Prevents two trigger executions from running at the same time and
  // creating duplicate rows.
  const lock = LockService.getScriptLock();
  const acquired = lock.tryLock(10000); // wait up to 10s for the lock

  if (!acquired) {
    console.log('processNewAlerts: Another run is active. Skipping this execution.');
    return;
  }

  try {
    console.log('=== processNewAlerts START === ' + new Date().toISOString());

    const messages = getUnreadTradingViewEmails();

    if (messages.length === 0) {
      console.log('No new TradingView emails found.');
      return;
    }

    console.log(`Processing ${messages.length} email(s)...`);

    for (const message of messages) {
      _processOneEmail(message);
    }

    console.log('=== processNewAlerts COMPLETE ===');

  } catch (e) {
    console.error('processNewAlerts: Unexpected error — ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Processes a single TradingView alert email end-to-end.
 * @private
 * @param {GmailMessage} message
 */
function _processOneEmail(message) {
  const msgId   = message.getId();
  const subject = message.getSubject();

  console.log(`Processing email: "${subject}" (ID: ${msgId})`);

  // ── Step 1: Duplicate check ──────────────────────────────────────────────
  if (isEmailAlreadyProcessed(msgId)) {
    console.log(`  → Duplicate detected. Skipping and marking read.`);
    message.markRead();
    return;
  }

  // ── Step 2: Parse email payload ──────────────────────────────────────────
  const payload = parseEmailPayload(message);

  if (!payload.success) {
    console.error(`  → Parse failed: ${payload.error}`);
    writeErrorLog(subject, payload.raw || '', payload.error);
    markEmailProcessed(message);
    return;
  }

  console.log(`  → Parsed: ${payload.direction} ${payload.event} on ${payload.symbol} @ ${payload.price}`);

  // ── Step 3: Write alert row to Google Sheets ─────────────────────────────
  // If this fails, do NOT mark email as read — it will be retried on next run.
  let rowNumber;
  try {
    rowNumber = writeAlertRow(payload);
  } catch (e) {
    console.error(`  → Sheet write failed: ${e.message}`);
    writeErrorLog(subject, payload.raw, 'Sheet write error: ' + e.message);
    return; // email stays unread → will retry
  }

  // ── Step 4: Call DeepSeek AI ─────────────────────────────────────────────
  console.log(`  → Calling DeepSeek for row ${rowNumber}...`);
  const analysis = analyzeWithDeepSeek(payload);

  const status = analysis.success ? 'Processed' : 'AI Error';
  updateAiSummary(rowNumber, analysis.text, status);

  if (analysis.success) {
    console.log(`  → AI analysis written to row ${rowNumber}.`);
  } else {
    console.warn(`  → AI analysis failed for row ${rowNumber}: ${analysis.text}`);
  }

  // ── Step 5: Mark email as processed ─────────────────────────────────────
  // Only done AFTER successful sheet write so email is never silently lost.
  markEmailProcessed(message);

  console.log(`  → Done. Row ${rowNumber} complete.`);
}

// ============================================================
// SETUP FUNCTIONS — Run these once manually from the editor
// ============================================================

/**
 * Creates the time-driven trigger that runs processNewAlerts every 5 minutes.
 * Safe to run multiple times — deletes existing triggers first to avoid duplicates.
 * Run this once from the Apps Script editor after deployment.
 */
function createTrigger() {
  // Remove any existing triggers for this function
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'processNewAlerts')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('processNewAlerts')
    .timeBased()
    .everyMinutes(5)
    .create();

  console.log('✅ Trigger created: processNewAlerts will run every 5 minutes.');
}

/**
 * Removes all project triggers. Run this to completely stop the automation.
 */
function removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  console.log('All triggers removed.');
}

/**
 * Initialises both Google Sheets (Trading Journal + Raw Logs) with headers
 * and formatting. Safe to run multiple times — will not overwrite existing data.
 * Run this once after creating your Google Sheet.
 */
function initialiseSheets() {
  getOrCreateSheet(CONFIG.JOURNAL_SHEET_NAME);
  getOrCreateSheet(CONFIG.LOGS_SHEET_NAME);
  console.log('✅ Sheets initialised successfully.');
}

// ============================================================
// TEST FUNCTIONS — Run from editor to verify each phase
// ============================================================

/**
 * PHASE 1 TEST
 * Writes a sample alert row to Google Sheets using a fake payload.
 * Does NOT read emails. Does NOT call DeepSeek.
 * Use this to verify sheet formatting and column layout.
 */
function testPhase1_WriteRow() {
  const samplePayload = {
    success:     true,
    id:          'test_' + Date.now(),
    subject:     '[Test] Bullish CHoCH on VOLATILITY_75_INDEX',
    symbol:      'VOLATILITY_75_INDEX',
    timeframe:   '5',
    event:       'Bullish CHoCH',
    direction:   'BULLISH',
    price:       41250.55,
    timestamp:   new Date(),
    trendBefore: 'BEARISH',
    trendAfter:  'BULLISH',
    pivotLevel:  41100.00,
    barIndex:    12345,
    structure:   'swing',
    raw:         '{"test": true}',
  };

  const row = writeAlertRow(samplePayload);
  console.log(`✅ Phase 1 test complete. Check row ${row} in your Google Sheet.`);
}

/**
 * PHASE 2 TEST
 * Calls DeepSeek with a sample payload and prints the response to the console.
 * Does NOT write to Google Sheets.
 * Use this to verify your DeepSeek API key and response quality.
 */
function testPhase2_DeepSeek() {
  const samplePayload = {
    symbol:      'VOLATILITY_75_INDEX',
    timeframe:   '5',
    event:       'Bullish CHoCH',
    direction:   'BULLISH',
    price:       41250.55,
    trendBefore: 'BEARISH',
    trendAfter:  'BULLISH',
    pivotLevel:  41100.00,
    structure:   'swing',
  };

  console.log('Calling DeepSeek...');
  const result = analyzeWithDeepSeek(samplePayload);
  console.log('Success:', result.success);
  console.log('Response:\n' + result.text);
}

/**
 * FULL END-TO-END TEST
 * Writes a sample row to Google Sheets AND calls DeepSeek.
 * Use this to verify the entire pipeline before waiting for a real alert.
 */
function testFullPipeline() {
  console.log('=== FULL PIPELINE TEST START ===');

  const samplePayload = {
    success:     true,
    id:          'fulltest_' + Date.now(),
    subject:     '[E2E Test] Bearish BOS on VOLATILITY_10_INDEX',
    symbol:      'VOLATILITY_10_INDEX',
    timeframe:   '5',
    event:       'Bearish BOS',
    direction:   'BEARISH',
    price:       1234.56,
    timestamp:   new Date(),
    trendBefore: 'BULLISH',
    trendAfter:  'BEARISH',
    pivotLevel:  1240.00,
    barIndex:    99999,
    structure:   'swing',
    raw:         '{"e2e_test": true}',
  };

  const row = writeAlertRow(samplePayload);
  console.log(`Row ${row} written.`);

  const analysis = analyzeWithDeepSeek(samplePayload);
  updateAiSummary(row, analysis.text, analysis.success ? 'Processed' : 'AI Error');

  console.log('=== FULL PIPELINE TEST COMPLETE ===');
  console.log(`Check row ${row} in your Google Sheet.`);
  console.log('AI Success:', analysis.success);
}
