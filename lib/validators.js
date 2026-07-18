import { config } from "./config.js";
import { logger } from "./logger.js";

/**
 * Validate the webhook payload from TradingView.
 * Returns { valid: true, signal: {...} } or { valid: false, reason: string }
 */
export function validateWebhookPayload(body, requestId) {
  logger.debug("Validating webhook payload", {
    request_id: requestId,
    component: "validators",
  });

  // Check secret
  if (!body.secret || body.secret !== config.webhook.secret) {
    return { valid: false, reason: "invalid_secret" };
  }

  // Check required fields
  const required = [
    "symbol",
    "timeframe",
    "event",
    "direction",
    "price",
    "timestamp",
    "trend_before",
    "trend_after",
    "pivot_level",
  ];

  for (const field of required) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      return { valid: false, reason: `missing_field:${field}` };
    }
  }

  // Validate symbol
  if (!validateSymbol(body.symbol)) {
    return { valid: false, reason: "invalid_symbol" };
  }

  // Validate timeframe
  if (!validateTimeframe(body.timeframe)) {
    return { valid: false, reason: "invalid_timeframe" };
  }

  // Validate event
  if (!validateEvent(body.event)) {
    return { valid: false, reason: "invalid_event" };
  }

  // Validate price is a number
  const price = parseFloat(body.price);
  if (isNaN(price) || price <= 0) {
    return { valid: false, reason: "invalid_price" };
  }

  // Validate timestamp is plausible (within 24 hours of now)
  const now = Date.now();
  const signalTime = parseInt(body.timestamp, 10);
  if (isNaN(signalTime) || Math.abs(now - signalTime) > 24 * 60 * 60 * 1000) {
    logger.warn("Signal timestamp outside plausible range", {
      request_id: requestId,
      component: "validators",
      signal_time: signalTime,
      server_time: now,
    });
    // Non-blocking — still accept the signal
  }

  return {
    valid: true,
    signal: {
      symbol: body.symbol,
      timeframe: body.timeframe,
      event: body.event,
      direction: body.direction,
      price,
      timestamp: signalTime,
      trend_before: body.trend_before,
      trend_after: body.trend_after,
      pivot_level: parseFloat(body.pivot_level),
      bar_index: body.bar_index || null,
    },
  };
}

export function validateSymbol(symbol) {
  return config.allowedSymbols.includes(symbol);
}

export function validateEvent(event) {
  return config.allowedEvents.includes(event);
}

export function validateTimeframe(tf) {
  return config.allowedTimeframes.includes(String(tf));
}
