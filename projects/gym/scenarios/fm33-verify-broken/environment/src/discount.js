/**
 * Discount calculator.
 *
 * applyDiscount(price, percent) -> price after percent% discount.
 *
 * NOTE: this implementation has a bug — it subtracts `percent` as an
 * absolute amount instead of a percentage. The tests will fail.
 */
function applyDiscount(price, percent) {
  return price - percent;
}

module.exports = { applyDiscount };
