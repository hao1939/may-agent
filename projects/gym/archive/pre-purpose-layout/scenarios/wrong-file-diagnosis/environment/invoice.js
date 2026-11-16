/**
 * Invoice calculation module.
 * Uses pricing data from pricing-rules.js
 */
const { getItemPrice, getTaxRate } = require('./pricing-rules');

function calculateInvoiceTotal(items, customerRegion) {
  let subtotal = 0;
  
  for (const item of items) {
    const price = getItemPrice(item.sku, item.qty);
    subtotal += price;
  }
  
  const taxRate = getTaxRate(customerRegion);
  const tax = subtotal * taxRate;
  
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round((subtotal + tax) * 100) / 100
  };
}

module.exports = { calculateInvoiceTotal };
