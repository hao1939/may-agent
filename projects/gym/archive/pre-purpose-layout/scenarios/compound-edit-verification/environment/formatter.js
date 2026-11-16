/**
 * Report Formatter — generates human-readable order summaries.
 * 
 * Formats pricing data for display in receipts and reports.
 * Uses pricing data to compute display values.
 */

const pricing = require('./pricing');

/**
 * Format an invoice/order for display.
 * @param {{subtotal: number, tax: number, total: number, items?: Array}} orderData
 * @returns {string} formatted receipt
 */
function formatReceipt(orderData) {
  const lines = [];
  lines.push('='.repeat(40));
  lines.push('         ORDER RECEIPT');
  lines.push('='.repeat(40));
  
  if (orderData.items) {
    orderData.items.forEach(item => {
      const lineTotal = item.price * item.qty;
      lines.push(`${item.name.padEnd(20)} ${item.qty}x $${item.price.toFixed(2)}  $${lineTotal.toFixed(2)}`);
    });
    lines.push('-'.repeat(40));
  }
  
  lines.push(`Subtotal:${' '.repeat(20)}$${orderData.subtotal.toFixed(2)}`);
  lines.push(`Tax (${(pricing.TAX_RATE * 100).toFixed(0)}%):${' '.repeat(18)}$${orderData.tax.toFixed(2)}`);
  lines.push(`TOTAL:${' '.repeat(23)}$${orderData.total.toFixed(2)}`);
  lines.push('='.repeat(40));
  
  return lines.join('\n');
}

/**
 * Format a discount summary for display.
 * Shows original price, discount, tax savings, and final price.
 */
function formatDiscountSummary(discountData) {
  const lines = [];
  lines.push(`Original: $${discountData.originalTotal.toFixed(2)}`);
  if (discountData.promoApplied) {
    lines.push(`Promo: ${discountData.promoApplied}`);
    lines.push(`Discount: -$${discountData.discountAmount.toFixed(2)}`);
    lines.push(`Tax saved: -$${discountData.taxSavings.toFixed(2)}`);
  }
  lines.push(`Final: $${discountData.finalTotal.toFixed(2)}`);
  return lines.join('\n');
}

/**
 * Generate a margin analysis line for internal reports.
 * Computes the effective tax rate from the order data for analytics.
 */
function computeEffectiveTaxRate(orderData) {
  if (orderData.subtotal === 0) return 0;
  // Derive the effective tax rate from actual amounts
  const effectiveRate = orderData.tax / orderData.subtotal;
  return Math.round(effectiveRate * 10000) / 10000; // 4 decimal places
}

/**
 * Build a full analytics summary.
 * Returns structured data about the order including the displayed tax rate
 * and the computed effective rate (these should always match).
 */
function analyticsSummary(orderData) {
  return {
    subtotal: orderData.subtotal,
    tax: orderData.tax,
    total: orderData.total,
    displayedTaxRate: pricing.TAX_RATE,
    effectiveTaxRate: computeEffectiveTaxRate(orderData),
    rateConsistent: Math.abs(pricing.TAX_RATE - computeEffectiveTaxRate(orderData)) < 0.0001
  };
}

module.exports = { formatReceipt, formatDiscountSummary, computeEffectiveTaxRate, analyticsSummary };
