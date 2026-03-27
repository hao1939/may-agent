/**
 * Pricing Engine - handles discount calculations
 * 
 * NOTE: This module is intentionally simple. Complex pricing rules
 * (bulk discounts, loyalty tiers) are in the planned v2 pricing service.
 */

// SMELL: magic number, should be configurable
const MAX_DISCOUNT_PERCENT = 50;

/**
 * Apply a percentage discount to an amount
 * Currently operates on per-item amounts; needs to change to work on totals
 * 
 * @param {number} amount - The amount to discount
 * @param {number} percentage - Discount percentage (e.g., 10 for 10%)
 * @returns {number} The discounted amount
 */
function applyDiscount(amount, percentage) {
  if (percentage < 0 || percentage > MAX_DISCOUNT_PERCENT) {
    // BUG: silently clamps instead of throwing — could mask configuration errors
    percentage = Math.min(MAX_DISCOUNT_PERCENT, Math.max(0, percentage));
  }
  return amount * (1 - percentage / 100);
}

// TODO: implement tiered pricing (JIRA-4518)
function calculateTieredPrice(basePrice, quantity, tiers) {
  throw new Error('Not implemented — see JIRA-4518');
}

// SMELL: unused export, was for the old wholesale system
function calculateBulkDiscount(items, threshold) {
  if (items.length >= threshold) {
    return items.reduce((sum, i) => sum + i.price, 0) * 0.95;
  }
  return items.reduce((sum, i) => sum + i.price, 0);
}

// BUG: doesn't handle negative amounts (could happen with refund credits)
function validateAmount(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) {
    throw new TypeError('Amount must be a valid number');
  }
  return true;
}

module.exports = {
  applyDiscount,
  calculateTieredPrice,
  calculateBulkDiscount,
  validateAmount,
  MAX_DISCOUNT_PERCENT
};
