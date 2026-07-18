// ============================================================
// deepseek.gs — DeepSeek API client
// AI Trend Assistant V1
// ============================================================

/**
 * Sends alert data to DeepSeek and returns a market structure explanation.
 * The AI is strictly instructed never to give Buy/Sell recommendations.
 *
 * API key must be stored in Apps Script → Project Settings → Script Properties
 * as: DEEPSEEK_API_KEY
 *
 * @param {Object} payload — parsed alert payload from gmail.gs
 * @returns {{ success: boolean, text: string }}
 */
function analyzeWithDeepSeek(payload) {

  // ── Read API key from secure Script Properties ──────────────────────────
  const apiKey = PropertiesService.getScriptProperties()
    .getProperty('DEEPSEEK_API_KEY');

  if (!apiKey || apiKey.trim() === '') {
    const msg = '⚠️ DeepSeek API key not configured. ' +
                'Go to Apps Script → Project Settings → Script Properties ' +
                'and add DEEPSEEK_API_KEY.';
    console.warn(msg);
    return { success: false, text: msg };
  }

  // ── Build prompts ────────────────────────────────────────────────────────
  const systemPrompt =
    'You are a professional Smart Money Concepts (SMC) market structure analyst.\n' +
    'You explain market structure events clearly and factually.\n' +
    'You NEVER recommend buying or selling.\n' +
    'You NEVER give trading signals or entry points.\n' +
    'You NEVER predict future price direction.\n' +
    'You ONLY explain what the detected market structure event means.\n' +
    'Keep your response under 150 words.\n' +
    'Always end your response with exactly this sentence: ' +
    '"The final trading decision belongs entirely to the user."';

  const userPrompt =
    `A ${payload.direction} ${payload.event} has been detected.\n\n` +
    `Symbol:           ${payload.symbol}\n` +
    `Timeframe:        ${payload.timeframe} minutes\n` +
    `Price at signal:  ${payload.price}\n` +
    `Trend before:     ${payload.trendBefore || 'N/A'}\n` +
    `Trend after:      ${payload.trendAfter  || 'N/A'}\n` +
    `Pivot level:      ${payload.pivotLevel  || 'N/A'}\n` +
    `Structure type:   ${payload.structure   || 'swing'}\n\n` +
    'Please explain what this market structure event means. ' +
    'The trader will manually review the chart before making any decision.';

  // ── Build request ────────────────────────────────────────────────────────
  const requestBody = {
    model:       CONFIG.DEEPSEEK_MODEL,
    temperature: CONFIG.TEMPERATURE,
    max_tokens:  CONFIG.MAX_TOKENS,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ],
  };

  const fetchOptions = {
    method:          'post',
    contentType:     'application/json',
    headers:         { 'Authorization': 'Bearer ' + apiKey },
    payload:         JSON.stringify(requestBody),
    muteHttpExceptions: true,
  };

  // ── First attempt ────────────────────────────────────────────────────────
  return _callDeepSeek(fetchOptions);
}

/**
 * Makes the HTTP call to DeepSeek, with one automatic retry on rate limit.
 * @private
 */
function _callDeepSeek(fetchOptions, isRetry) {
  try {
    const response = UrlFetchApp.fetch(CONFIG.DEEPSEEK_API_URL, fetchOptions);
    const code     = response.getResponseCode();
    const bodyText = response.getContentText();

    // ── Success ────────────────────────────────────────────────────────────
    if (code === 200) {
      const json = JSON.parse(bodyText);
      if (json.choices && json.choices.length > 0) {
        const text = json.choices[0].message.content.trim();
        console.log('DeepSeek response received (' + text.length + ' chars).');
        return { success: true, text };
      }
      return { success: false, text: '⚠️ DeepSeek returned no content. Please retry.' };
    }

    // ── Rate limit — retry once ────────────────────────────────────────────
    if (code === 429 && !isRetry) {
      console.warn('DeepSeek rate limit hit. Retrying in 3 seconds...');
      Utilities.sleep(3000);
      return _callDeepSeek(fetchOptions, true);
    }

    // ── Other HTTP error ───────────────────────────────────────────────────
    const errorMsg = `⚠️ AI analysis unavailable (HTTP ${code}). ` +
                     `Response: ${bodyText.substring(0, 200)}`;
    console.error(errorMsg);
    return { success: false, text: errorMsg };

  } catch (e) {
    const errorMsg = `⚠️ AI analysis unavailable – network error: ${e.message}`;
    console.error(errorMsg);
    return { success: false, text: errorMsg };
  }
}
