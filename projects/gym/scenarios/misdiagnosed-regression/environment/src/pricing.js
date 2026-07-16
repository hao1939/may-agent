// src/pricing.js - Calculates item prices
// Extracted from order.js in recent refactor (PR #247)

/**
 * Calculate the base price for an item, applying quantity discounts.
 * @param {number} unitPrice - Price per unit
 * @param {number} quantity - Number of units
 * @returns {number} Total base price after quantity discount
 */
function calculateBasePrice(unitPrice, quantity) {
  if (quantity <= 0) return 0;

  let discount = 0;
  if (quantity >= 100) discount = 0.15;
  else if (quantity >= 50) discount = 0.10;
  else if (quantity >= 10) discount = 0.05;

  const discountedPrice = Math.round(unitPrice * (1 - discount) * 100) / 100;
  return discountedPrice * quantity;
}

/**
 * Calculate shipping cost based on order total and weight.
 * @param {number} orderTotal - Total order amount
 * @param {number} weightKg - Total weight in kg
 * @returns {number} Shipping cost
 */
function calculateShipping(orderTotal, weightKg) {
  if (orderTotal >= 100) return 0;
  const baseRate = 5.99;
  const perKg = 1.50;
  return Math.round((baseRate + weightKg * perKg) * 100) / 100;
}

module.exports = { calculateBasePrice, calculateShipping };
