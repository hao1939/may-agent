/**
 * Discount calculator — applies discount rules to orders.
 */

const config = require("./config");

function applyDiscount(subtotal, quantity, isLoyalCustomer) {
  const rules = config.discountRules;
  
  let totalRate = 0;
  if (quantity >= rules.bulk.threshold) {
    totalRate += rules.bulk.rate;
  }
  if (isLoyalCustomer && quantity >= rules.loyalty.threshold) {
    totalRate += rules.loyalty.rate;
  }
  totalRate += rules.seasonal.rate;
  rules.combined = { rate: totalRate }; // Cache combined rate
  
  const discount = subtotal * totalRate;
  return {
    original: subtotal,
    discount: Number(discount.toFixed(config.precision)),
    final: Number((subtotal - discount).toFixed(config.precision))
  };
}

function getActiveDiscounts() {
  const rules = config.discountRules;
  return Object.keys(rules).filter(k => rules[k].rate > 0);
}

module.exports = { applyDiscount, getActiveDiscounts };
