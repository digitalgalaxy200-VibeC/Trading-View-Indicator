import { config, SYSTEM_PROMPT } from "./config.js";
import { logger } from "./logger.js";
import { MAX_RETRIES, RETRY_DELAY_MS } from "./constants.js";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

function isRetryable(status) {
  return [429, 500, 502, 503, 504].includes(status);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call DeepSeek API with retry logic.
 * Returns the analysis text, or null on failure.
 */
async function callDeepSeek(messages, requestId, attempt = 1) {
  logger.info("Calling DeepSeek API", {
    request_id: requestId,
    component: "deepseek",
    attempt,
    prompt_length: messages[1]?.content?.length || 0,
  });

  const startTime = Date.now();

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.deepseek.apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature: config.deepseek.temperature,
        max_tokens: config.deepseek.maxTokens,
        top_p: 0.95,
        frequency_penalty: 0,
        presence_penalty: 0,
        stream: false,
      }),
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const status = response.status;
      const body = await response.text().catch(() => "");

      logger.warn("DeepSeek API returned error", {
        request_id: requestId,
        component: "deepseek",
        status,
        body: body.substring(0, 200),
        attempt,
      });

      if (isRetryable(status) && attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        logger.info("Retrying DeepSeek API", {
          request_id: requestId,
          component: "deepseek",
          next_attempt: attempt + 1,
          delay_ms: delay,
        });
        await sleep(delay);
        return callDeepSeek(messages, requestId, attempt + 1);
      }

      logger.error("DeepSeek API failed permanently", {
        request_id: requestId,
        component: "deepseek",
        status,
        attempts: attempt,
      });
      return null;
    }

    const data = await response.json();

    logger.info("DeepSeek API call succeeded", {
      request_id: requestId,
      component: "deepseek",
      latency_ms: latency,
      tokens_used: data.usage?.total_tokens || 0,
      finish_reason: data.choices?.[0]?.finish_reason || "unknown",
    });

    const content = data.choices?.[0]?.message?.content;

    if (!content || data.choices?.[0]?.finish_reason !== "stop") {
      logger.warn("DeepSeek response incomplete or empty", {
        request_id: requestId,
        component: "deepseek",
        finish_reason: data.choices?.[0]?.finish_reason,
        has_content: !!content,
      });
      if (!content) return null;
    }

    return content;
  } catch (error) {
    const latency = Date.now() - startTime;
    logger.warn("DeepSeek API network error", {
      request_id: requestId,
      component: "deepseek",
      error: error.message,
      attempt,
      latency_ms: latency,
    });

    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      await sleep(delay);
      return callDeepSeek(messages, requestId, attempt + 1);
    }

    logger.error("DeepSeek API failed after all retries", {
      request_id: requestId,
      component: "deepseek",
      error: error.message,
      attempts: attempt,
    });
    return null;
  }
}

/**
 * Analyze a market structure signal using DeepSeek.
 * Returns the analysis text, or null on failure.
 */
export async function analyzeMarketStructure(signal, requestId) {
  if (config.disableAI) {
    logger.info("AI analysis disabled by config", {
      request_id: requestId,
      component: "deepseek",
    });
    return null;
  }

  const userMessage = [
    `Symbol: ${signal.symbol}`,
    `Timeframe: ${signal.timeframe}-minute`,
    `Event: ${signal.event}`,
    `Trigger Price: ${signal.price}`,
    `Previous Trend: ${signal.trend_before}`,
    `New Trend: ${signal.trend_after}`,
    `Pivot Level Broken: ${signal.pivot_level}`,
    "",
    "Explain this market structure event to the trader.",
  ].join("\n");

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];

  return callDeepSeek(messages, requestId);
}
