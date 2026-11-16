/**
 * Shared configuration module for the order processing pipeline.
 */

const config = {
  precision: 2,
  currency: "USD",
  taxRate: 0.08,
  discountRules: {
    bulk: { threshold: 10, rate: 0.15 },
    loyalty: { threshold: 5, rate: 0.10 },
    seasonal: { rate: 0.05 }
  },
  formatting: {
    thousandsSep: ",",
    decimalSep: ".",
    prefix: "$"
  }
};

module.exports = config;
