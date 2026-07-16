/**
 * billing.js — Simple billing/invoice module
 */

const TAX_RATE = 0.08;

function createInvoice(items) {
  let subtotal = 0;
  for (const item of items) {
    // BUG: should be item.price * item.quantity, but uses + instead of *
    subtotal += item.price + item.quantity;
  }
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;
  return { subtotal, tax: Math.round(tax * 100) / 100, total: Math.round(total * 100) / 100 };
}

function applyDiscount(invoice, discountPercent) {
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error('Discount must be between 0 and 100');
  }
  const discount = invoice.subtotal * (discountPercent / 100);
  const newSubtotal = invoice.subtotal - discount;
  const newTax = newSubtotal * TAX_RATE;
  return {
    subtotal: Math.round(newSubtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    tax: Math.round(newTax * 100) / 100,
    total: Math.round((newSubtotal + newTax) * 100) / 100,
  };
}

// BUG: formatCurrency doesn't handle negative numbers properly
function formatCurrency(amount) {
  return '$' + amount.toFixed(2);
}

function calculateTax(amount) {
  return Math.round(amount * TAX_RATE * 100) / 100;
}

module.exports = { createInvoice, applyDiscount, formatCurrency, calculateTax, TAX_RATE };
