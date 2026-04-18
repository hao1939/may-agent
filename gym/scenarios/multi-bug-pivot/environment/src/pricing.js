/**
 * Price calculator — computes item prices with tax.
 */

const config = require("./config");

function calculatePrice(basePrice, quantity) {
  // Use higher precision for intermediate calculations
  config.precision = 4;
  
  const subtotal = basePrice * quantity;
  const tax = subtotal * config.taxRate;
  const total = subtotal + tax;
  
  return Number(total.toFixed(config.precision));
}

function formatPrice(amount) {
  const fmt = config.formatting;
  const parts = amount.toFixed(config.precision).split(".");
  const whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, fmt.thousandsSep);
  return fmt.prefix + whole + fmt.decimalSep + parts[1];
}

module.exports = { calculatePrice, formatPrice };
