/**
 * Invoice Generator — creates structured invoices from pricing data.
 * 
 * Uses pricing.calculateTotal() for all calculations.
 */

const { calculateTotal, validateItems } = require('./pricing');

let invoiceCounter = 1000;

/**
 * Generate an invoice for the given items.
 * @param {string} customer
 * @param {Array<{name: string, price: number, qty: number}>} items
 * @returns {object} invoice
 */
function generateInvoice(customer, items) {
  const validation = validateItems(items);
  if (!validation.valid) {
    throw new Error(`Invalid items: ${validation.errors.join(', ')}`);
  }
  
  const pricing = calculateTotal(items);
  const invoiceId = `INV-${++invoiceCounter}`;
  
  return {
    id: invoiceId,
    customer,
    items: items.map(item => ({
      name: item.name,
      price: item.price,
      qty: item.qty,
      lineTotal: item.price * item.qty
    })),
    subtotal: pricing.subtotal,
    tax: pricing.tax,
    total: pricing.total,
    itemCount: pricing.itemCount,
    date: new Date().toISOString().split('T')[0],
    status: 'pending'
  };
}

/**
 * Calculate a quick estimate (no invoice created).
 */
function quickEstimate(items) {
  return calculateTotal(items);
}

module.exports = { generateInvoice, quickEstimate };
