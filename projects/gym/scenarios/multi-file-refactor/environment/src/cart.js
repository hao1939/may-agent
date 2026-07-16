// cart.js — Shopping cart module
const { calculateTotal } = require('./pricing');

function getCartSummary(cartItems) {
  const result = calculateTotal(cartItems);
  return {
    itemCount: cartItems.length,
    ...result,
    formatted: `$${result.total.toFixed(2)}`
  };
}

module.exports = { getCartSummary };
