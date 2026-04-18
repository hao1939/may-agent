/**
 * Billing Database Adapter
 * 
 * Simulates fetching invoice line items from the billing database.
 * The database uses DECIMAL columns for monetary values, which
 * the Node.js driver returns as strings to preserve precision.
 */

// Simulated database records — amounts are strings (as returned by DB driver)
const INVOICES = {
  'INV-001': {
    id: 'INV-001',
    customer: 'Acme Corp',
    items: [
      { description: 'Widget Pro', amount: '150.00', quantity: 2 },
      { description: 'Gadget Plus', amount: '75.50', quantity: 1 },
      { description: 'Service Fee', amount: '25.00', quantity: 1 },
    ],
    discountPercent: 10,
    taxRate: 0.08,
    status: 'pending',
  },
  'INV-002': {
    id: 'INV-002',
    customer: 'Beta LLC',
    items: [
      { description: 'Basic Widget', amount: 50, quantity: 5 },
      { description: 'Support Plan', amount: 200, quantity: 1 },
    ],
    discountPercent: 0,
    taxRate: 0.08,
    status: 'paid',
  },
  'INV-003': {
    id: 'INV-003',
    customer: 'Gamma Inc',
    items: [
      { description: 'Enterprise License', amount: '500.00', quantity: 1 },
      { description: 'Setup Fee', amount: '100.00', quantity: 1 },
      { description: 'Training', amount: 75, quantity: 3 },
    ],
    discountPercent: 15,
    taxRate: 0.10,
    status: 'pending',
  },
};

/**
 * Fetch an invoice by ID.
 * @param {string} id
 * @returns {object|null}
 */
function getInvoice(id) {
  return INVOICES[id] || null;
}

/**
 * Fetch all invoices for a given status.
 * @param {string} status
 * @returns {object[]}
 */
function getInvoicesByStatus(status) {
  return Object.values(INVOICES).filter(inv => inv.status === status);
}

/**
 * Get all invoice IDs.
 * @returns {string[]}
 */
function getInvoiceIds() {
  return Object.keys(INVOICES);
}

module.exports = {
  getInvoice,
  getInvoicesByStatus,
  getInvoiceIds,
};
