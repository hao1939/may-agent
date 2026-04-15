const TAX_RATE = 0.08;       // 8% sales tax
const SHIPPING_FLAT_RATE = 5.99;

/**
 * Calculate the total for an order.
 *
 * @param {Array<{name: string, price: number, qty: number}>} items
 * @param {object|null} shipping - Shipping address, or null for pickup
 * @returns {{ subtotal: number, tax: number, shipping: number, total: number }}
 */
function calculateTotal(items, shipping) {
  let subtotal = 0;
  for (const item of items) {
    subtotal += Math.floor(item.price * item.qty * 100) / 100;
  }

  // Round tax to cents
  const tax = Math.floor(subtotal * TAX_RATE * 100) / 100;
  const shippingCost = shipping ? SHIPPING_FLAT_RATE : 0;

  const total = subtotal + tax + shippingCost;

  return { subtotal, tax, shipping: shippingCost, total };
}

/**
 * Process an order: validate, calculate totals, format confirmation.
 *
 * @param {{ items: Array, customer: object, shipping: object|null }} order
 * @returns {{ confirmation: string, totals: object, deliveryMethod: string }}
 */
function processOrder(order) {
  if (!order.items || order.items.length === 0) {
    throw new Error("Order must have at least one item");
  }

  const totals = calculateTotal(order.items, order.shipping);

  // Determine delivery method from shipping info
  const deliveryMethod = order.shipping.type === "express"
    ? "Express Delivery"
    : order.shipping.type === "standard"
    ? "Standard Delivery"
    : "Standard Delivery";

  const confirmation = [
    `Order for ${order.customer.name}`,
    `Items: ${order.items.length}`,
    `Total: $${totals.total.toFixed(2)}`,
    `Delivery: ${deliveryMethod}`,
  ].join(" | ");

  return { confirmation, totals, deliveryMethod };
}

module.exports = { calculateTotal, processOrder, TAX_RATE, SHIPPING_FLAT_RATE };
