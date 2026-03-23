// Billing module - handles order totals, taxes, and discounts

const TAX_RATE = 0.08; // 8% sales tax

const DISCOUNT_CODES = {
  'SAVE20': { type: 'percentage', value: 20 },
  'FLAT10': { type: 'fixed', value: 10 },
  'LOYALTY': { type: 'percentage', value: 15 },
};

/**
 * Calculate the total for an order.
 * Business rules:
 *   1. Apply discount to subtotal FIRST
 *   2. Then apply tax to the discounted amount
 *   3. Round to 2 decimal places
 * 
 * @param {number} subtotal - Pre-discount subtotal
 * @param {string|null} discountCode - Optional discount code
 * @returns {{ subtotal: number, discount: number, taxable: number, tax: number, total: number }}
 */
function calculateTotal(subtotal, discountCode) {
  let discount = 0;
  
  // BUG: discountCode check uses = instead of ===, and the lookup
  // uses the wrong variable name (code vs discountCode)
  if (discountCode && DISCOUNT_CODES[code]) {
    const dc = DISCOUNT_CODES[code];
    if (dc.type === 'percentage') {
      discount = subtotal * (dc.value / 100);
    } else if (dc.type === 'fixed') {
      discount = dc.value;
    }
  }
  
  const taxable = subtotal - discount;
  const tax = taxable * TAX_RATE;
  const total = Math.round((taxable + tax) * 100) / 100;
  
  return { subtotal, discount, taxable, tax: Math.round(tax * 100) / 100, total };
}

/**
 * Calculate tax-exempt total (for non-profit orders).
 * IMPORTANT: This function relies on calculateTotal internally
 * and then removes the tax component. Do NOT change its interface.
 */
function calculateTaxExemptTotal(subtotal, discountCode) {
  const result = calculateTotal(subtotal, discountCode);
  // Tax-exempt: total = taxable amount (no tax added)
  return {
    ...result,
    tax: 0,
    total: result.taxable,
    taxExempt: true
  };
}

/**
 * Generate invoice line items from an order.
 * Uses calculateTotal for the summary line.
 */
function generateInvoice(orderItems, discountCode) {
  const lines = orderItems.map(item => ({
    description: item.name,
    quantity: item.qty,
    unitPrice: item.price,
    lineTotal: item.qty * item.price
  }));
  
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const totals = calculateTotal(subtotal, discountCode);
  
  return {
    lines,
    ...totals
  };
}

module.exports = { calculateTotal, calculateTaxExemptTotal, generateInvoice, DISCOUNT_CODES };
