/**
 * formatter.js — Formats values for display output.
 * Handles padding, alignment, and number formatting.
 */

const DEFAULT_WIDTH = 10;

function formatNumber(num, width) {
  const str = String(num);
  if (str.length >= width) {
    return str;
  }
  // Pad to reach desired width
  return str.padStart(width, '0');
}

function formatCurrency(amount, symbol) {
  symbol = symbol || '$';
  const formatted = amount.toFixed(2);
  return `${symbol}${formatted}`;
}

function formatPercentage(value, decimals) {
  decimals = decimals || 1;
  return `${(value * 100).toFixed(decimals)}%`;
}

function formatTable(rows, columns) {
  const header = columns.map(c => c.padEnd(DEFAULT_WIDTH)).join(' | ');
  const separator = columns.map(() => '-'.repeat(DEFAULT_WIDTH)).join('-+-');
  const body = rows.map(row =>
    columns.map(c => String(row[c] || '').padEnd(DEFAULT_WIDTH)).join(' | ')
  );
  return [header, separator, ...body].join('\n');
}

module.exports = { formatNumber, formatCurrency, formatPercentage, formatTable };
