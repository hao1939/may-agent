/**
 * Pricing Engine — core pricing calculations.
 * 
 * Currently uses a flat 8% tax rate for all orders.
 * See TAX_RATE export for the current rate.
 */

const TAX_RATE = 0.08;

/**
 * Calculate the total for a list of line items.
 * @param {Array<{name: string, price: number, qty: number}>} items
 * @returns {{subtotal: number, tax: number, total: number, itemCount: number}}
 */
function calculateTotal(items) {
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const total = subtotal + tax;
  const itemCount = items.reduce((count, item) => count + item.qty, 0);
  
  return { subtotal, tax, total, itemCount };
}

/**
 * Get the tax amount for a given subtotal.
 * @param {number} subtotal
 * @returns {number}
 */
function getTax(subtotal) {
  return Math.round(subtotal * TAX_RATE * 100) / 100;
}

/**
 * Validate line items.
 * @param {Array} items
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateItems(items) {
  const errors = [];
  if (!Array.isArray(items) || items.length === 0) {
    errors.push('Items must be a non-empty array');
    return { valid: false, errors };
  }
  
  items.forEach((item, i) => {
    if (!item.name) errors.push(`Item ${i}: missing name`);
    if (typeof item.price !== 'number' || item.price <= 0) errors.push(`Item ${i}: invalid price`);
    if (typeof item.qty !== 'number' || item.qty < 1) errors.push(`Item ${i}: invalid quantity`);
  });
  
  return { valid: errors.length === 0, errors };
}

module.exports = { calculateTotal, getTax, validateItems, TAX_RATE };
