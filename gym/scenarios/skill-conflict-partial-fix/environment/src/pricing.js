/**
 * Pricing module — handles price calculations with tax, discounts, and bulk pricing.
 * 
 * KNOWN ISSUE: Finance team reports rounding discrepancies with Stripe.
 * roundCurrency() uses floor-based rounding instead of banker's rounding.
 */

/**
 * Round a currency amount to 2 decimal places.
 * BUG: Uses floor rounding — should use banker's rounding (round half to even).
 */
function roundCurrency(amount) {
  return Math.floor(amount * 100) / 100;
}

/**
 * Calculate price with tax.
 * @param {number} basePrice - Pre-tax price
 * @param {number} taxRate - Tax rate as decimal (e.g., 0.0875 for 8.75%)
 * @returns {{ subtotal: number, tax: number, total: number }}
 */
function calculateWithTax(basePrice, taxRate) {
  const tax = roundCurrency(basePrice * taxRate);
  const total = roundCurrency(basePrice + tax);
  return { subtotal: basePrice, tax, total };
}

/**
 * Apply a percentage discount to a price.
 * The discount is applied before tax.
 * @param {number} basePrice - Original price
 * @param {number} discountPercent - Discount as percentage (e.g., 15 for 15%)
 * @param {number} taxRate - Tax rate as decimal
 * @returns {{ originalPrice: number, discount: number, discountedPrice: number, tax: number, total: number }}
 */
function applyDiscount(basePrice, discountPercent, taxRate) {
  const discountAmount = roundCurrency(basePrice * (discountPercent / 100));
  const discountedPrice = roundCurrency(basePrice - discountAmount);
  const tax = roundCurrency(discountedPrice * taxRate);
  const total = roundCurrency(discountedPrice + tax);
  return {
    originalPrice: basePrice,
    discount: discountAmount,
    discountedPrice,
    tax,
    total
  };
}

/**
 * Calculate bulk pricing with tiered discounts.
 * - 1-9 units: full price
 * - 10-49 units: 5% discount
 * - 50-99 units: 10% discount  
 * - 100+ units: 15% discount
 * @param {number} unitPrice - Price per unit
 * @param {number} quantity - Number of units
 * @param {number} taxRate - Tax rate as decimal
 * @returns {{ unitPrice: number, quantity: number, discount: number, subtotal: number, tax: number, total: number }}
 */
function calculateBulkPrice(unitPrice, quantity, taxRate) {
  let discountPercent = 0;
  if (quantity >= 100) discountPercent = 15;
  else if (quantity >= 50) discountPercent = 10;
  else if (quantity >= 10) discountPercent = 5;

  const effectivePrice = roundCurrency(unitPrice * (1 - discountPercent / 100));
  const subtotal = roundCurrency(effectivePrice * quantity);
  const tax = roundCurrency(subtotal * taxRate);
  const total = roundCurrency(subtotal + tax);

  return {
    unitPrice: effectivePrice,
    quantity,
    discount: discountPercent,
    subtotal,
    tax,
    total
  };
}

module.exports = {
  roundCurrency,
  calculateWithTax,
  applyDiscount,
  calculateBulkPrice
};
