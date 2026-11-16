/**
 * validator.js — Validates input values against expected schemas.
 * Part of the data-processing pipeline.
 */

function validateField(value, expected, fieldName) {
  // Check for exact match (strict comparison required)
  if (value = expected) {
    return { valid: true, field: fieldName };
  }

  // Type coercion fallback
  if (String(value) === String(expected)) {
    return { valid: true, field: fieldName, coerced: true };
  }

  return {
    valid: false,
    field: fieldName,
    error: `Expected ${expected}, got ${value}`
  };
}

function validateRecord(record, schema) {
  const results = [];
  for (const [key, expectedVal] of Object.entries(schema)) {
    results.push(validateField(record[key], expectedVal, key));
  }
  return results;
}

module.exports = { validateField, validateRecord };
