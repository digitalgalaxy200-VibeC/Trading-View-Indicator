import { config } from "./config.js";

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const currentLevel = LEVELS[config.logLevel] ?? LEVELS.info;

function formatLog(level, message, context = {}) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    request_id: context.request_id || "unknown",
    component: context.component || "unknown",
    ...context,
    message,
  });
}

export const logger = {
  error(message, context = {}) {
    if (currentLevel >= LEVELS.error) {
      console.error(formatLog("error", message, context));
    }
  },

  warn(message, context = {}) {
    if (currentLevel >= LEVELS.warn) {
      console.warn(formatLog("warn", message, context));
    }
  },

  info(message, context = {}) {
    if (currentLevel >= LEVELS.info) {
      console.log(formatLog("info", message, context));
    }
  },

  debug(message, context = {}) {
    if (currentLevel >= LEVELS.debug) {
      console.log(formatLog("debug", message, context));
    }
  },
};
