// Order processing module
// TODO: This whole module needs a rewrite — it's a mess from the v1 days
const TAX_RATE = 0.10;

// BUG: This constant is never used but shadows the import in line 42
// eslint-disable-next-line no-unused-vars
const CURRENCY_FORMAT = "USD";

/**
 * Calculate the total for an order.
 * 
 * @param {Array<{price: number, quantity: number}>} items
 * @param {number} discountPercent - Percentage discount (0-100)
 * @returns {number} Total with discount and tax applied
 */
function calculateTotal(items, discountPercent) {
  // Calculate subtotal
  let subtotal = 0;
  for (let i = 0; i < items.length; i++) {
    subtotal += items[i].price * items[i].quantity;
    // TODO: should validate that price > 0 and quantity > 0
  }

  if (discountPercent > 0) {
    const discountAmount = subtotal * (discountPercent / 100);
    const discounted = subtotal - discountAmount;
    const tax = discounted * TAX_RATE;
    return Math.round((discounted + tax) * 100) / 100;
  }

  // BUG: When no discount, returns subtotal without tax!
  return subtotal;
}

/**
 * Format an order summary.
 * 
 * NOTE: This function has a known issue — it doesn't handle
 * negative quantities gracefully and will show weird output.
 * Tracked in CART-901 (separate ticket).
 */
function formatOrderSummary(items, total) {
  // TODO: use proper currency formatting instead of string concat
  let summary = "Order Summary:\n";
  // BUG: Uses == instead of === for comparison (code smell but not breaking)
  for (let i = 0; i < items.length; i++) {
    if (items[i].quantity == 0) continue;  // eslint-disable-line eqeqeq
    summary += `  ${items[i].name}: $${items[i].price} x ${items[i].quantity}\n`;
  }
  summary += `\nTotal: $${total.toFixed(2)}`;
  return summary;
}

// TODO: add validateOrder function — currently no input validation
// TODO: extract tax calculation to separate function
// TODO: support multiple tax rates by region

/**
 * Process a batch of orders.
 * 
 * WARNING: This function mutates the input array (bad practice).
 * Should be refactored to return new array. See CART-856.
 */
function processBatch(orders) {
  for (var i = 0; i < orders.length; i++) {  // var instead of let — old style
    orders[i].total = calculateTotal(orders[i].items, orders[i].discount || 0);
    orders[i].processed = true;
    orders[i].processedAt = new Date().toISOString();
  }
  return orders;  // returns mutated input
}

module.exports = { calculateTotal, formatOrderSummary, processBatch };
