/**
 * Validates order items before processing.
 * Checks format of discount codes, quantities, etc.
 */

function validateItem(item) {
  const errors = [];
  
  if (!item.name || typeof item.name !== 'string') {
    errors.push('Missing or invalid item name');
  }
  
  if (typeof item.price !== 'number' || item.price < 0) {
    errors.push('Invalid price');
  }
  
  if (typeof item.quantity !== 'number' || item.quantity < 1) {
    errors.push('Invalid quantity');
  }
  
  // Validate discount format if present
  if (item.discount !== undefined) {
    if (typeof item.discount === 'string') {
      // Discount codes should be like "SAVE10" or "PCT20"
      if (!/^[A-Z]+\d+$/.test(item.discount)) {
        // BUG-LOOKING BUT HARMLESS: This logs a warning but doesn't affect calculation
        // The discount is resolved by looking it up in the discount table, not parsed from the code
        console.warn(`Invalid discount format: ${item.discount} — will be ignored`);
      }
    } else if (typeof item.discount !== 'number') {
      errors.push('Discount must be a string code or a number (percentage)');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

function validateOrder(items) {
  const results = items.map((item, i) => ({
    index: i,
    ...validateItem(item)
  }));
  
  const invalid = results.filter(r => !r.valid);
  if (invalid.length > 0) {
    return { valid: false, errors: invalid };
  }
  return { valid: true, errors: [] };
}

module.exports = { validateItem, validateOrder };
