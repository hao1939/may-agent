/**
 * validate.js — Validation Module (PARTIAL)
 * 
 * Extracted from process.js by the previous session.
 * NOTE: This extraction appears incomplete — only 2 of 4 validation
 * functions were moved here before the session ended.
 */

// ============================================================
// VALIDATION CONSTANTS
// ============================================================

const VALID_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
const MAX_QUANTITY_PER_ITEM = 100;
const MAX_LINE_ITEMS = 50;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// ============================================================
// VALIDATION FUNCTIONS
// ============================================================

function validateEmail(email) {
  if (typeof email !== 'string') return { valid: false, error: 'Email must be a string' };
  if (!EMAIL_REGEX.test(email)) return { valid: false, error: 'Invalid email format' };
  return { valid: true };
}

function validateLineItem(item) {
  const errors = [];
  if (!item || typeof item !== 'object') return { valid: false, errors: ['Item must be an object'] };
  if (!item.name || typeof item.name !== 'string') errors.push('Item name is required');
  if (typeof item.price !== 'number' || item.price < 0) errors.push('Item price must be a non-negative number');
  if (!Number.isInteger(item.quantity) || item.quantity < 1) errors.push('Item quantity must be a positive integer');
  if (item.quantity > MAX_QUANTITY_PER_ITEM) errors.push(`Item quantity cannot exceed ${MAX_QUANTITY_PER_ITEM}`);
  return { valid: errors.length === 0, errors };
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  validateEmail,
  validateLineItem,
  VALID_CURRENCIES,
  MAX_QUANTITY_PER_ITEM,
  MAX_LINE_ITEMS,
  EMAIL_REGEX
};
