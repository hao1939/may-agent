/**
 * Invoice Calculator Module
 * 
 * Calculates totals, taxes, and discounts for invoices.
 * Line item data comes from the billing database where
 * monetary values are stored as DECIMAL and returned as strings.
 */

/**
 * Calculate the subtotal from line items.
 * Each item has: { description, amount }
 * where amount is the line total (unitPrice × quantity, pre-computed by DB).
 *
 * @param {object[]} items - Line items from billing DB
 * @returns {number} Subtotal
 */
function calculateSubtotal(items) {
  let subtotal = 0;
  for (const item of items) {
    subtotal += item.amount;
  }
  return subtotal;
}

/**
 * Apply a percentage discount to an amount.
 * @param {number} amount
 * @param {number} discountPercent - e.g., 10 for 10%
 * @returns {number} Discounted amount
 */
function applyDiscount(amount, discountPercent) {
  if (discountPercent == 0) {
    return amount;
  }
  return amount - (amount * discountPercent / 100);
}

/**
 * Calculate tax on an amount.
 * @param {number} amount
 * @param {number} taxRate - e.g., 0.08 for 8%
 * @returns {number} Tax amount rounded to 2 decimal places
 */
function calculateTax(amount, taxRate) {
  return Math.round(amount * taxRate * 100) / 100;
}

/**
 * Calculate the full invoice.
 * @param {object[]} items - Line items with amount
 * @param {object} options - { discountPercent, taxRate }
 * @returns {object} { subtotal, discount, taxableAmount, tax, total }
 */
function calculateInvoice(items, options = {}) {
  const { discountPercent = 0, taxRate = 0.08 } = options;

  const subtotal = calculateSubtotal(items);
  const afterDiscount = applyDiscount(subtotal, discountPercent);
  const tax = calculateTax(afterDiscount, taxRate);
  const total = afterDiscount + tax;

  return {
    subtotal,
    discount: subtotal - afterDiscount,
    taxableAmount: afterDiscount,
    tax,
    total,
  };
}

/**
 * Validate that an invoice meets minimum order requirements.
 * @param {object[]} items - Line items
 * @param {number} minimumOrder - Minimum order value (default $10)
 * @returns {{ valid: boolean, error?: string }}
 */
function validateOrder(items, minimumOrder = 10) {
  if (!items || items.length === 0) {
    return { valid: false, error: 'Order must contain at least one item' };
  }

  const subtotal = calculateSubtotal(items);
  if (subtotal < minimumOrder) {
    return { valid: false, error: `Order total $${subtotal} is below minimum $${minimumOrder}` };
  }

  return { valid: true };
}

/**
 * Format a currency value for display.
 * @param {number} amount
 * @returns {string} Formatted like "$1,234.56"
 */
function formatCurrency(amount) {
  return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

module.exports = {
  calculateSubtotal,
  applyDiscount,
  calculateTax,
  calculateInvoice,
  validateOrder,
  formatCurrency,
};
