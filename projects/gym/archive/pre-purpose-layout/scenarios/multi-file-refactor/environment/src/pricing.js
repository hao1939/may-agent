// pricing.js — Core pricing module

function calculateTotal(items, taxRate = 0.08) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * taxRate;
  return { subtotal, tax, total: subtotal + tax };
}

function applyDiscount(total, discountPercent) {
  return total * (1 - discountPercent / 100);
}

module.exports = { calculateTotal, applyDiscount };
