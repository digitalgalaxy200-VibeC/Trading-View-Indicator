import { config } from "./config.js";
import { logger } from "./logger.js";
import {
  MAX_RETRIES,
  RETRY_DELAY_MS,
  TELEGRAM_MAX_MESSAGE_LENGTH,
  EVENT_EMOJI,
  SAFETY_FILTER_PATTERNS,
} from "./constants.js";

function isRetryable(status) {
  return [429, 500, 502, 503, 504].includes(status);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Escape HTML special characters for Telegram parse_mode: "HTML"
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Apply safety filter to strip any line that recommends trading actions.
 * Returns the filtered text and a boolean indicating if any lines were removed.
 */
function applySafetyFilter(text) {
  let filtered = false;
  const lines = text.split("\n");
  const clean = lines.filter((line) => {
    for (const pattern of SAFETY_FILTER_PATTERNS) {
      if (pattern.test(line)) {
        filtered = true;
        return false;
      }
    }
    return true;
  });
  return { text: clean.join("\n"), filtered };
}

/**
 * Format a signal + AI analysis into a Telegram HTML message.
 */
export function formatSignalMessage(signal, analysis) {
  const emoji = EVENT_EMOJI[signal.event] || "\u2139\uFE0F"; // info emoji fallback
  const priceFormatted = signal.price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const pivotFormatted = signal.pivot_level.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const timeStr = new Date(signal.timestamp).toISOString().replace("T", " ").substring(0, 19);

  let message = [
    `<b>${emoji} ${escapeHtml(signal.event)}</b>`,
    `${escapeHtml(signal.symbol)} | ${signal.timeframe}m`,
    "\u2500".repeat(32),
    `Price: <b>${priceFormatted}</b>`,
    `Direction: ${escapeHtml(signal.trend_before)} \u2192 ${escapeHtml(signal.trend_after)}`,
    `Pivot: ${pivotFormatted}`,
    "",
  ];

  if (analysis) {
    const escaped = escapeHtml(analysis.trim());
    const { text: safe, filtered } = applySafetyFilter(escaped);

    if (filtered) {
      logger.warn("Safety filter removed content from AI response", {
        component: "telegram",
        symbol: signal.symbol,
        event: signal.event,
      });
    }

    message.push(safe);
  } else {
    message.push(
      "\u26A0\uFE0F <i>AI analysis unavailable \u2014 please review the chart manually.</i>"
    );
  }

  message.push("");
  message.push("\u2500".repeat(32));
  message.push(
    `<i>AI Trend Continuation Assistant | ${timeStr} UTC | For review only</i>`
  );

  const fullMessage = message.join("\n");

  // Truncate if exceeding Telegram limit
  if (fullMessage.length > TELEGRAM_MAX_MESSAGE_LENGTH) {
    const truncated =
      fullMessage.substring(0, TELEGRAM_MAX_MESSAGE_LENGTH - 3) + "\u2026";
    logger.warn("Message truncated for Telegram length limit", {
      component: "telegram",
      original_length: fullMessage.length,
      max_length: TELEGRAM_MAX_MESSAGE_LENGTH,
    });
    return truncated;
  }

  return fullMessage;
}

/**
 * Send a message via Telegram Bot API with retry logic.
 * Returns the message_id on success, or null on failure.
 */
export async function sendMessage(text, requestId, attempt = 1) {
  const url = `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`;

  logger.info("Sending Telegram message", {
    request_id: requestId,
    component: "telegram",
    attempt,
    message_length: text.length,
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.telegram.chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const body = await response.text().catch(() => "");

      logger.warn("Telegram API returned error", {
        request_id: requestId,
        component: "telegram",
        status,
        body: body.substring(0, 200),
        attempt,
      });

      if (isRetryable(status) && attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(delay);
        return sendMessage(text, requestId, attempt + 1);
      }

      logger.error("Telegram API failed permanently", {
        request_id: requestId,
        component: "telegram",
        status,
        attempts: attempt,
      });
      return null;
    }

    const data = await response.json();

    logger.info("Telegram message sent successfully", {
      request_id: requestId,
      component: "telegram",
      message_id: data.result?.message_id,
    });

    return data.result?.message_id || null;
  } catch (error) {
    logger.warn("Telegram API network error", {
      request_id: requestId,
      component: "telegram",
      error: error.message,
      attempt,
    });

    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      await sleep(delay);
      return sendMessage(text, requestId, attempt + 1);
    }

    logger.error("Telegram API failed after all retries", {
      request_id: requestId,
      component: "telegram",
      error: error.message,
      attempts: attempt,
    });
    return null;
  }
}
