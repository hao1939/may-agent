/**
 * Validator module — validates records using registered plugins.
 * 
 * This module looks up validation plugins from the registry and
 * applies them to record fields.
 * 
 * NOTE: If validation fails with "Cannot read properties of undefined",
 * it's likely because the plugin type isn't recognized. Check that
 * the field type matches a registered plugin name exactly.
 */

const registry = require('./registry');

/**
 * Validate a single field value against its type plugin.
 * @param {string} type - The field type (e.g., 'email', 'phone')
 * @param {*} value - The value to validate
 * @returns {object} { valid: boolean, message?: string }
 */
function validateField(type, value) {
  const plugin = registry.getPlugin(type);
  const result = plugin.validate(value);
  return result;
}

/**
 * Validate an entire record against a schema.
 * @param {object} record - The data record to validate
 * @param {object} schema - Map of fieldName -> type
 * @returns {object} { valid: boolean, errors: array }
 */
function validateRecord(record, schema) {
  const errors = [];
  
  for (const [field, type] of Object.entries(schema)) {
    if (!(field in record)) {
      errors.push({ field, message: 'Missing required field' });
      continue;
    }
    
    try {
      const result = validateField(type, record[field]);
      if (!result.valid) {
        errors.push({ field, message: result.message });
      }
    } catch (err) {
      errors.push({ field, message: `Validation error: ${err.message}` });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if a type has a registered validator.
 */
function hasValidator(type) {
  return registry.getPlugin(type) !== undefined;
}

module.exports = { validateField, validateRecord, hasValidator };
