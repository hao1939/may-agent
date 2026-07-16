/**
 * validator.js — Validates incoming records
 * 
 * Valid records must have:
 * - id: positive integer
 * - name: non-empty string
 * - category: one of 'electronics', 'clothing', 'food', 'books'
 * - amount: positive number (string representation, e.g., "49.95")
 * - quantity: positive integer
 */

const VALID_CATEGORIES = ['electronics', 'clothing', 'food', 'books'];

function validateRecords(records) {
  const valid = [];
  const invalid = [];

  for (const record of records) {
    const errors = [];

    if (!record.id || typeof record.id !== 'number' || record.id <= 0) {
      errors.push('invalid id');
    }
    if (!record.name || typeof record.name !== 'string' || record.name.trim() === '') {
      errors.push('invalid name');
    }
    if (!VALID_CATEGORIES.includes(record.category)) {
      errors.push(`invalid category: ${record.category}`);
    }
    if (!record.amount || isNaN(parseFloat(record.amount)) || parseFloat(record.amount) <= 0) {
      errors.push('invalid amount');
    }
    if (!record.quantity || typeof record.quantity !== 'number' || record.quantity <= 0) {
      errors.push('invalid quantity');
    }

    if (errors.length === 0) {
      valid.push(record);
    } else {
      invalid.push({ record, errors });
    }
  }

  return { valid, invalid };
}

module.exports = { validateRecords };
