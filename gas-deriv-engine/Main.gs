// ============================================================
// Main.gs — Orchestrator and Triggers
// AI Trend Assistant — Deriv Engine
// ============================================================

/**
 * MAIN ENTRY POINT
 * This function should be triggered on a time-based schedule 
 * (e.g. every 1 minute for testing, or every 15 minutes in production).
 */
function runEngine() {
  // Use LockService to prevent concurrent executions
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    console.warn('Another instance is currently running. Exiting.');
    return;
  }

  try {
    console.log('--- Deriv Engine Run Started ---');

    // 1. Initialize dependencies
    const stateStore = new StateStore();
    const engine = new MarketStructureEngine(stateStore);
    const repo = new SheetsRepository();

    // 2. Fetch the latest candles (last 100) from the proxy
    console.log(`Fetching candles for ${CONFIG.SYMBOL} at ${CONFIG.TIMEFRAME}s timeframe...`);
    const candles = DerivProxyClient.fetchRecentCandles(100);
    console.log(`Retrieved ${candles.length} candles. Latest epoch: ${candles[candles.length - 1].epoch}`);

    // 3. Process candles incrementally to find new events
    const newEvents = engine.process(candles);

    if (newEvents.length === 0) {
      console.log('No new events detected. Engine sleep.');
      return;
    }

    // 4. Handle newly detected events
    for (const event of newEvents) {
      console.log(`Detected: ${event.event} at ${event.price}`);
      
      // Deduplication check
      if (repo.isDuplicateEvent(event.id)) {
        console.log(`Event ${event.id} already processed. Skipping.`);
        continue;
      }

      // Generate AI Context (DeepSeek is only called when an event happens)
      console.log(`Calling DeepSeek for event context...`);
      const aiAnalysis = DeepSeekClient.analyzeEvent(event);
      
      // Save to Google Sheets
      console.log(`Logging event to Google Sheets...`);
      repo.logEvent(event, aiAnalysis);
      
      // Send Email
      console.log(`Dispatching email alert...`);
      NotificationService.sendAlert(event, aiAnalysis);
    }

    console.log('--- Deriv Engine Run Complete ---');

  } catch (error) {
    console.error(`Engine Error: ${error.message}`);
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// SETUP & TEST FUNCTIONS 
// Run these manually from the editor.
// ============================================================

/**
 * Sets up a time-driven trigger to run the engine every minute.
 * Run this ONCE when deploying for testing.
 */
function createMinuteTrigger() {
  // Delete existing triggers first
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('runEngine')
    .timeBased()
    .everyMinutes(1)
    .create();
    
  console.log('✅ Trigger created: runEngine will run every 1 minute.');
}

/**
 * Stop the engine completely.
 */
function removeAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  console.log('🚫 All triggers removed.');
}

/**
 * Hard-reset the state. Useful if you want the engine to recalculate
 * from the 100-candle window as if it was running for the first time.
 */
function resetState() {
  const store = new StateStore();
  store._initializeSheet();
  console.log('State reset to default.');
}

/**
 * Test function: just fetch candles from the proxy and log them.
 * Does not write to sheets or call DeepSeek.
 */
function testDerivProxy() {
  try {
    const candles = DerivProxyClient.fetchRecentCandles(5);
    console.log('Successfully fetched last 5 candles:');
    console.log(JSON.stringify(candles, null, 2));
  } catch (e) {
    console.error(e.message);
  }
}
