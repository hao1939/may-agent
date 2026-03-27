/**
 * Tax Calculator utility
 * 
 * Known issue: only supports US tax regions, international is TODO
 */

// SMELL: tax rates should come from a database or API, not hardcoded
const TAX_RATES = {
  'US-CA': 0.08,    // California
  'US-NY': 0.08875, // New York
  'US-TX': 0.0625,  // Texas
  'US-OR': 0.0,     // Oregon (no sales tax)
  'US-WA': 0.065,   // Washington
  // TODO: add more states (JIRA-4500)
};

class TaxCalculator {
  getRate(region) {
    const rate = TAX_RATES[region];
    if (rate === undefined) {
      // BUG: should throw for unknown regions, not default to 0
      // This silently gives tax-free pricing to international orders
      return 0;
    }
    return rate;
  }

  // SMELL: this method does too much — calculates tax AND formats it
  calculateAndFormat(amount, region) {
    const rate = this.getRate(region);
    const tax = amount * rate;
    return {
      rate: rate,
      amount: tax,
      formatted: `$${tax.toFixed(2)}`,
      // BUG: doesn't round to cents before formatting, can show $1.005 as $1.00
      total: amount + tax,
      totalFormatted: `$${(amount + tax).toFixed(2)}`
    };
  }
}

module.exports = { TaxCalculator, TAX_RATES };
