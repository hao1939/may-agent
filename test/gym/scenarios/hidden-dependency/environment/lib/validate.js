/**
 * validate.js — Data integrity checks
 * 
 * Verifies pricing rules against their stored checksum.
 * IMPORTANT: If checksum validation fails, the pipeline must abort.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function validatePricing(rulesPath) {
  const raw = fs.readFileSync(rulesPath, 'utf8');
  const rules = JSON.parse(raw);
  
  // Compute checksum from the business-critical fields only
  const payload = JSON.stringify({
    discount_threshold: rules.discount_threshold,
    discount_rate: rules.discount_rate
  });
  const computed = crypto.createHash('md5').update(payload).digest('hex').slice(0, 6);
  
  if (computed !== rules.checksum) {
    throw new Error(`Pricing checksum mismatch: expected ${rules.checksum}, got ${computed}`);
  }
  
  return rules;
}

function validateTransactions(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('Transaction file is empty');
  }
  return lines.length - 1; // exclude header
}

module.exports = { validatePricing, validateTransactions };
