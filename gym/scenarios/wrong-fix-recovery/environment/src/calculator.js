/**
 * Price calculator — computes totals for orders.
 * 
 * Known discount codes are looked up in the DISCOUNTS table.
 * Numeric discounts are treated as percentage off.
 */

const DISCOUNTS = {
  'SAVE10': 0.10,
  'SAVE20': 0.20,
  'PCT20': 0.20,
  'HALF': 0.50,
  'VIP25': 0.25
};

function resolveDiscount(discount) {
  if (discount === undefined || discount === null) {
    return 0;
  }
  if (typeof discount === 'number') {
    // Numeric discount = percentage (e.g., 15 means 15%)
    return discount / 100;
  }
  if (typeof discount === 'string') {
    return DISCOUNTS[discount] || 0;
  }
  return 0;
}

function calculateItemTotal(item) {
  const basePrice = item.price * item.quantity;
  const discountRate = resolveDiscount(item.discount);
  const discounted = basePrice * (1 - discountRate);
  
  const TAX_RATE = 0.085;
  const total = discounted * (1 + TAX_RATE);
  
  // BUG: Math.trunc truncates toward zero instead of rounding.
  // For $19.99 * 1.085 = $21.68915 → trunc gives $21.68 (should be $21.69)
  // This causes small but consistent errors in totals.
  return Math.trunc(total * 100) / 100;
}

function calculateOrderTotal(items) {
  let subtotal = 0;
  const lineItems = [];
  
  for (const item of items) {
    const itemTotal = calculateItemTotal(item);
    lineItems.push({
      name: item.name,
      unitPrice: item.price,
      quantity: item.quantity,
      discount: item.discount || null,
      total: itemTotal
    });
    subtotal += itemTotal;
  }
  
  return {
    lineItems,
    subtotal: Math.round(subtotal * 100) / 100
  };
}

module.exports = { calculateItemTotal, calculateOrderTotal, resolveDiscount };
