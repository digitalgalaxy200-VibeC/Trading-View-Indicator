// ============================================================
// DeepSeekClient.gs — DeepSeek API Client
// AI Trend Assistant — Deriv Engine
// ============================================================

/**
 * Sends event data to DeepSeek and returns market structure context.
 * The AI is strictly instructed never to give Buy/Sell recommendations.
 * 
 * API key must be stored in Apps Script → Project Settings → Script Properties 
 * as: DEEPSEEK_API_KEY
 */
class DeepSeekClient {

  static analyzeEvent(event) {
    const apiKey = PropertiesService.getScriptProperties().getProperty('DEEPSEEK_API_KEY');

    if (!apiKey) {
      console.warn('⚠️ DeepSeek API key not configured in Script Properties.');
      return '⚠️ API Key missing. Please configure DEEPSEEK_API_KEY.';
    }

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
      `A ${event.direction} ${event.event} has been detected.\n\n` +
      `Symbol:           ${CONFIG.SYMBOL}\n` +
      `Timeframe:        ${CONFIG.TIMEFRAME} seconds\n` +
      `Price at signal:  ${event.price}\n` +
      `Trend before:     ${event.trendBefore}\n` +
      `Trend after:      ${event.trendAfter}\n` +
      `Broken Pivot:     ${event.pivotLevel}\n\n` +
      'Please explain what this market structure event means. ' +
      'The trader will manually review the chart before making any decision.';

    const requestBody = {
      model: CONFIG.DEEPSEEK_MODEL,
      temperature: CONFIG.TEMPERATURE,
      max_tokens: CONFIG.MAX_TOKENS,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + apiKey },
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    };

    try {
      const response = UrlFetchApp.fetch(CONFIG.DEEPSEEK_API_URL, options);
      const code = response.getResponseCode();
      const body = response.getContentText();

      if (code === 200) {
        const json = JSON.parse(body);
        if (json.choices && json.choices.length > 0) {
          return json.choices[0].message.content.trim();
        }
      }
      console.error(`DeepSeek Error (HTTP ${code}): ${body}`);
      return `⚠️ AI analysis failed (HTTP ${code}).`;
    } catch (e) {
      console.error(`DeepSeek Network Error: ${e.message}`);
      return `⚠️ AI network error: ${e.message}`;
    }
  }
}
