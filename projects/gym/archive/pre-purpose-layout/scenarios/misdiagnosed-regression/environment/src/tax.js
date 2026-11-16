// src/tax.js - Tax calculation module
// Note: this module predates the recent refactor and was not changed in PR #247

const TAX_RATES = {
  'US-CA': 0.0725,
  'US-NY': 0.08,
  'US-TX': 0.0625,
  'US-OR': 0,
  'CA-ON': 0.13,
  'CA-BC': 0.12,
};

/**
 * Calculate tax for an order.
 * @param {number} subtotal - Pre-tax order total
 * @param {string} region - Tax region code (e.g., 'US-CA')
 * @param {object} customer - Customer object
 * @param {boolean|string} customer.taxExempt - Whether customer is tax-exempt
 * @returns {number} Tax amount
 */
function calculateTax(subtotal, region, customer) {
  if (!customer) return 0;

  // Check if customer is tax exempt
  if (customer.taxExempt == true) {
    return 0;
  }

  const rate = TAX_RATES[region];
  if (rate === undefined) {
    throw new Error(`Unknown tax region: ${region}`);
  }

  return Math.round(subtotal * rate * 100) / 100;
}

/**
 * Validate a tax region code.
 * @param {string} region - Region code to validate
 * @returns {boolean} Whether the region is valid
 */
function isValidRegion(region) {
  return region in TAX_RATES;
}

module.exports = { calculateTax, isValidRegion, TAX_RATES };
