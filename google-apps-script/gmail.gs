// ============================================================
// gmail.gs — Gmail reading, parsing, and duplicate prevention
// AI Trend Assistant V1
// ============================================================

/**
 * Returns all unread TradingView alert emails from Gmail.
 * @returns {GmailMessage[]}
 */
function getUnreadTradingViewEmails() {
  const threads = GmailApp.search(CONFIG.GMAIL_SEARCH_QUERY, 0, 50);
  const messages = [];

  for (const thread of threads) {
    for (const msg of thread.getMessages()) {
      if (msg.isUnread()) {
        messages.push(msg);
      }
    }
  }

  console.log(`getUnreadTradingViewEmails: found ${messages.length} message(s).`);
  return messages;
}

/**
 * Parses a TradingView alert email and extracts the structured payload.
 * Expects the email body to contain the JSON block produced by buildWebhookJson()
 * in Godwin's Indicator Pine Script.
 *
 * @param {GmailMessage} message
 * @returns {{ success: boolean, [key: string]: any }}
 */
function parseEmailPayload(message) {
  const id      = message.getId();
  const subject = message.getSubject();
  const body    = message.getPlainBody();

  // ── Step 1: Find a JSON block anywhere in the email body ──────────────────
  // TradingView wraps the alert message in the email body. Our JSON may have
  // surrounding whitespace or TradingView footer text after it.
  const jsonMatch = body.match(/\{[\s\S]*?\}/);

  if (!jsonMatch) {
    return {
      success: false,
      id,
      subject,
      raw: body,
      error: 'No JSON block found in email body. ' +
             'Ensure TradingView alert message is set to {{alert_message}}.',
    };
  }

  // ── Step 2: Parse the JSON ────────────────────────────────────────────────
  let payload;
  try {
    payload = JSON.parse(jsonMatch[0]);
  } catch (e) {
    return {
      success: false,
      id,
      subject,
      raw: body,
      error: `JSON parse error: ${e.message}. Raw match: ${jsonMatch[0].substring(0, 200)}`,
    };
  }

  // ── Step 3: Validate required fields ─────────────────────────────────────
  const required = ['symbol', 'event', 'direction', 'price'];
  for (const field of required) {
    if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
      return {
        success: false,
        id,
        subject,
        raw: JSON.stringify(payload),
        error: `Missing required field: "${field}"`,
      };
    }
  }

  // ── Step 4: Parse timestamp ────────────────────────────────────────────────
  // Pine Script sends Unix ms timestamp. Fall back to email received time.
  let alertTime;
  try {
    alertTime = payload.timestamp
      ? new Date(parseInt(payload.timestamp, 10))
      : message.getDate();
  } catch (_) {
    alertTime = message.getDate();
  }

  return {
    success:     true,
    id,
    subject,
    symbol:      String(payload.symbol).trim(),
    timeframe:   String(payload.timeframe || '5').trim(),
    event:       String(payload.event).trim(),
    direction:   String(payload.direction).trim().toUpperCase(),
    price:       parseFloat(payload.price),
    timestamp:   alertTime,
    trendBefore: String(payload.trend_before || '').trim(),
    trendAfter:  String(payload.trend_after  || '').trim(),
    pivotLevel:  parseFloat(payload.pivot_level) || '',
    barIndex:    payload.bar_index || '',
    structure:   String(payload.structure || 'swing').trim(),
    raw:         JSON.stringify(payload, null, 2),
  };
}

/**
 * Marks an email as read and applies the "Processed by Script" Gmail label.
 * Creates the label automatically if it does not exist.
 *
 * @param {GmailMessage} message
 */
function markEmailProcessed(message) {
  message.markRead();

  let label = GmailApp.getUserLabelByName(CONFIG.PROCESSED_LABEL);
  if (!label) {
    label = GmailApp.createLabel(CONFIG.PROCESSED_LABEL);
  }
  message.getThread().addLabel(label);
}
