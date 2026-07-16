const fs = require("fs");
const path = require("path");

/**
 * Load configuration from .env file.
 * Values are returned as-is from the file.
 */
function loadConfig() {
  const envPath = path.join(__dirname, "..", ".env");
  const config = {};

  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      config[key] = value;
    }
  }

  return {
    retryInterval: config.RETRY_INTERVAL_MS,
    maxRetryInterval: config.MAX_RETRY_INTERVAL_MS,
  };
}

module.exports = { loadConfig };
