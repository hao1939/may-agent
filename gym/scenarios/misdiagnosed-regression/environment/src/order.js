// src/order.js - Order processing
// Recently refactored in PR #247: pricing logic extracted to pricing.js

const { calculateBasePrice, calculateShipping } = require('./pricing');
const { calculateTax, isValidRegion } = require('./tax');

/**
 * Process an order and return the complete order summary.
 * @param {Array} items - Array of {name, unitPrice, quantity, weightKg}
 * @param {string} region - Tax region code
 * @param {object} customer - Customer object with at least {name, taxExempt}
 * @returns {object} Order summary
 */
function processOrder(items, region, customer) {
  if (!items || items.length === 0) {
    throw new Error('Order must have at least one item');
  }

  if (!isValidRegion(region)) {
    throw new Error(`Invalid region: ${region}`);
  }

  const lineItems = items.map(item => {
    const subtotal = calculateBasePrice(item.unitPrice, item.quantity);
    return {
      name: item.name,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      subtotal,
    };
  });

  const subtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0);
  const totalWeight = items.reduce((sum, item) => sum + (item.weightKg || 0) * item.quantity, 0);
  const shipping = calculateShipping(subtotal, totalWeight);
  const tax = calculateTax(subtotal, region, customer);
  const total = Math.round((subtotal + shipping + tax) * 100) / 100;

  return {
    customer: customer.name,
    lineItems,
    subtotal: Math.round(subtotal * 100) / 100,
    shipping,
    tax,
    total,
  };
}

module.exports = { processOrder };
