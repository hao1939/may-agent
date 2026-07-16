/**
 * Price calculator — computes item prices with tax.
 */

const config = require("./config");

function calculatePrice(basePrice, quantity) {
  const subtotal = basePrice * quantity;
  const tax = subtotal * config.taxRate;
  const total = subtotal + tax;
  
  return Number(total.toFixed(2));
}

function formatPrice(amount) {
  const fmt = config.formatting;
  const parts = amount.toFixed(config.precision).split(".");
  const whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, fmt.thousandsSep);
  return fmt.prefix + whole + fmt.decimalSep + parts[1];
}

module.exports = { calculatePrice, formatPrice };
