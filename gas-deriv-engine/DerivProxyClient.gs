// ============================================================
// DerivProxyClient.gs — HTTP Client to Cloudflare Proxy
// AI Trend Assistant — Deriv Engine
// ============================================================

/**
 * Connects to the Cloudflare Worker to fetch historical OHLC candles
 * from the Deriv WebSocket API.
 */
class DerivProxyClient {

  /**
   * Fetches the most recent candles for the configured symbol and timeframe.
   * @param {number} count Number of candles to fetch (e.g., 100)
   * @returns {Array} Array of candle objects { epoch, open, high, low, close }
   */
  static fetchRecentCandles(count = 100) {
    if (!CONFIG.CLOUDFLARE_WORKER_URL || CONFIG.CLOUDFLARE_WORKER_URL.includes('your-worker-url-here')) {
      throw new Error("CLOUDFLARE_WORKER_URL is not configured in Config.gs.");
    }

    const payload = {
      ticks_history: CONFIG.SYMBOL,
      style: "candles",
      granularity: CONFIG.TIMEFRAME,
      count: count,
      end: "latest"
    };

    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(CONFIG.CLOUDFLARE_WORKER_URL, options);
    const code = response.getResponseCode();
    const content = response.getContentText();

    if (code !== 200) {
      throw new Error(`Deriv Proxy Error HTTP ${code}: ${content}`);
    }

    const json = JSON.parse(content);
    
    if (json.error) {
      throw new Error(`Deriv API Error: ${json.error.message}`);
    }

    if (!json.candles || json.candles.length === 0) {
      throw new Error("Deriv API returned no candles.");
    }

    return json.candles;
  }
}
