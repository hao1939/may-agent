/**
 * Formats order results for display.
 */

function formatLineItem(item) {
  const discountStr = item.discount ? ` (discount: ${item.discount})` : '';
  return `  ${item.name}: ${item.quantity}x $${item.unitPrice.toFixed(2)}${discountStr} = $${item.total.toFixed(2)}`;
}

function formatReceipt(orderResult) {
  const lines = ['=== ORDER RECEIPT ==='];
  for (const item of orderResult.lineItems) {
    lines.push(formatLineItem(item));
  }
  lines.push(`  ---`);
  lines.push(`  TOTAL: $${orderResult.subtotal.toFixed(2)}`);
  lines.push('=====================');
  return lines.join('\n');
}

module.exports = { formatLineItem, formatReceipt };
