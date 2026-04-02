/**
 * Configuration validator.
 *
 * Validates config objects against a schema. The same validation logic
 * is used in two places:
 * 1. validateConfig() for full config objects
 * 2. validatePartial() for partial updates (patch operations)
 *
 * Both share the same field validators defined in FIELD_VALIDATORS.
 */

// Bug: port range check allows port 0 and port 65536
// The correct range is 1-65535
const FIELD_VALIDATORS = {
  host: (v) => typeof v === "string" && v.length > 0,
  port: (v) => typeof v === "number" && v >= 0 && v <= 65536,
  timeout: (v) => typeof v === "number" && v > 0 && v <= 300,
  retries: (v) => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 10,
  logLevel: (v) => ["debug", "info", "warn", "error"].includes(v),
};

const REQUIRED_FIELDS = ["host", "port"];

function validateConfig(config) {
  const errors = [];

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (!(field in config)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate each field
  for (const [key, value] of Object.entries(config)) {
    const validator = FIELD_VALIDATORS[key];
    if (!validator) {
      errors.push(`Unknown field: ${key}`);
    } else if (!validator(value)) {
      errors.push(`Invalid value for ${key}: ${value}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function validatePartial(patch) {
  const errors = [];

  for (const [key, value] of Object.entries(patch)) {
    const validator = FIELD_VALIDATORS[key];
    if (!validator) {
      errors.push(`Unknown field: ${key}`);
    } else if (!validator(value)) {
      errors.push(`Invalid value for ${key}: ${value}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// Convenience: merge and validate
function mergeAndValidate(base, patch) {
  const merged = { ...base, ...patch };
  return { merged, ...validateConfig(merged) };
}

module.exports = { validateConfig, validatePartial, mergeAndValidate, FIELD_VALIDATORS };
