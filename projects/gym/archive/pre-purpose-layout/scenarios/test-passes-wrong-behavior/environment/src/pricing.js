/**
 * Pricing Module
 * 
 * IMPORTANT: All monetary calculations MUST use banker's rounding (round-half-to-even)
 * per finance team requirement (see docs/pricing-spec.md section 3.2).
 * This ensures we don't systematically over/under-charge on half-cent values.
 * 
 * Last modified: 2026-04-10 by junior-dev (refactored for clarity)
 */

// Round to 2 decimal places
function roundCurrency(amount) {
  // Standard rounding (Math.round)
  return Math.round(amount * 100) / 100;
}

function calculateLineItem(unitPrice, quantity) {
  const subtotal = unitPrice * quantity;
  return roundCurrency(subtotal);
}

function calculateTax(subtotal, taxRate) {
  const tax = subtotal * taxRate;
  return roundCurrency(tax);
}

function calculateOrder(items, taxRate = 0.0825) {
  let subtotal = 0;
  
  const lineItems = items.map(item => {
    const lineTotal = calculateLineItem(item.unitPrice, item.quantity);
    subtotal += lineTotal;
    return {
      name: item.name,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      total: lineTotal
    };
  });

  const tax = calculateTax(subtotal, taxRate);
  const total = roundCurrency(subtotal + tax);

  return {
    lineItems,
    subtotal: roundCurrency(subtotal),
    tax,
    total
  };
}

module.exports = { calculateLineItem, calculateTax, calculateOrder, roundCurrency };
