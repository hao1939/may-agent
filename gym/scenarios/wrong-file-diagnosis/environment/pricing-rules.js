/**
 * Pricing rules — item prices and tax rates.
 */

const CATALOG = {
  'WIDGET-A': { basePrice: 25.00, bulkThreshold: 10, bulkPrice: 22.50 },
  'WIDGET-B': { basePrice: 42.50, bulkThreshold: 5, bulkPrice: 38.25 },
  'GADGET-X': { basePrice: 99.99, bulkThreshold: null, bulkPrice: null },
};

const TAX_RATES = {
  'US-CA': 0.0875,
  'US-NY': 0.08,
  'US-TX': 0.0625,
  'EU-DE': 0.19,
  'EXEMPT': 0,
};

function getItemPrice(sku, qty) {
  const item = CATALOG[sku];
  if (!item) throw new Error(`Unknown SKU: ${sku}`);
  
  // Use bulk pricing if over threshold
  const unitPrice = (item.bulkThreshold && qty > item.bulkThreshold) 
    ? item.bulkPrice 
    : item.basePrice;
  
  return unitPrice * qty;
}

function getTaxRate(region) {
  const rate = TAX_RATES[region];
  if (rate === undefined) throw new Error(`Unknown region: ${region}`);
  return rate;
}

module.exports = { getItemPrice, getTaxRate, CATALOG, TAX_RATES };
