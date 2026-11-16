/**
 * Config loader — reads config from a JSON file and validates it.
 *
 * Has its OWN port validation that's duplicated from config-validator.js.
 * This is the "phantom" — fixing config-validator.js alone won't fix
 * the loader.
 */
const fs = require("fs");
const { validateConfig } = require("./config-validator");

// Duplicated port check — same bug as config-validator.js
function isValidPort(port) {
  return typeof port === "number" && port >= 0 && port <= 65536;
}

function loadConfig(filePath) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (err) {
    return { config: null, error: `Failed to read config: ${err.message}` };
  }

  // Quick port sanity check before full validation
  if (raw.port !== undefined && !isValidPort(raw.port)) {
    return { config: null, error: `Invalid port: ${raw.port}` };
  }

  const result = validateConfig(raw);
  if (!result.valid) {
    return { config: null, error: result.errors.join("; ") };
  }

  return { config: raw, error: null };
}

module.exports = { loadConfig, isValidPort };
