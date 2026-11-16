/**
 * Invoice Calculator Module
 * Computes totals, taxes, and discounts for line-item invoices.
 */

/**
 * Calculate the subtotal of line items.
 * @param {Array<{quantity: number, unitPrice: number}>} items
 * @returns {number}
 */
function subtotal(items) {
  if (!Array.isArray(items)) return 0;
  let sum = 0;
  for (const item of items) {
    sum += item.quantity * item.unitPrice;
  }
  return sum;
}

/**
 * Apply a percentage discount.
 * @param {number} amount
 * @param {number} discountPercent - e.g., 10 for 10%
 * @returns {number} - Discounted amount
 */
function applyDiscount(amount, discountPercent) {
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error('Discount must be between 0 and 100');
  }
  const discount = amount * (discountPercent / 100);
  return Math.round((amount - discount) * 100) / 100;
}

/**
 * Calculate tax on an amount.
 * @param {number} amount
 * @param {number} taxRate - e.g., 0.08 for 8%
 * @returns {number}
 */
function calculateTax(amount, taxRate) {
  return amount * taxRate;
}

/**
 * Generate a full invoice summary.
 * @param {Array<{quantity: number, unitPrice: number}>} items
 * @param {number} discountPercent
 * @param {number} taxRate
 * @returns {{subtotal: number, discount: number, taxableAmount: number, tax: number, total: number}}
 */
function invoiceSummary(items, discountPercent, taxRate) {
  const sub = subtotal(items);
  const discounted = applyDiscount(sub, discountPercent);
  const discountAmount = Math.round((sub - discounted) * 100) / 100;
  const tax = calculateTax(discounted, taxRate);
  const total = Math.round((discounted + tax) * 100) / 100;
  
  return {
    subtotal: sub,
    discount: discountAmount,
    taxableAmount: discounted,
    tax,
    total
  };
}

module.exports = { subtotal, applyDiscount, calculateTax, invoiceSummary };
