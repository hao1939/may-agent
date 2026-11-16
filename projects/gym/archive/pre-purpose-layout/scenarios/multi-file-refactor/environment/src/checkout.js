// checkout.js — Checkout flow
const { calculateTotal, applyDiscount } = require('./pricing');

function processCheckout(cartItems, couponCode) {
  const { subtotal, tax, total } = calculateTotal(cartItems);
  
  let finalTotal = total;
  if (couponCode === 'SAVE10') {
    finalTotal = applyDiscount(total, 10);
  }
  
  return {
    subtotal,
    tax,
    discount: total - finalTotal,
    finalTotal,
    status: 'confirmed'
  };
}

module.exports = { processCheckout };
