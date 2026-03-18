/**
 * process.js — Transaction report pipeline
 * 
 * Reads transactions, applies pricing rules, outputs report.
 */
const fs = require('fs');
const path = require('path');
const { validatePricing, validateTransactions } = require('./lib/validate');

const DATA_PATH = path.join(__dirname, 'data', 'transactions.csv');
const RULES_PATH = path.join(__dirname, 'rules', 'pricing.json');
const OUTPUT_DIR = path.join(__dirname, 'output');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'report.json');

function parseTransactions(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw.trim().split('\n');
  const header = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    const fields = line.split(',');
    return {
      id: parseInt(fields[0]),
      amount: parseFloat(fields[1]),
      date: fields[2],
      category: fields[3]
    };
  });
}

function generateReport(transactions, rules) {
  const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);
  const discountApplied = totalRevenue > rules.discount_threshold;
  const finalRevenue = discountApplied 
    ? totalRevenue * (1 - rules.discount_rate)
    : totalRevenue;
    
  return {
    total_transactions: transactions.length,
    total_revenue: totalRevenue,
    discount_applied: discountApplied,
    final_revenue: Math.round(finalRevenue * 100) / 100
  };
}

// --- Main ---
try {
  // Validate inputs
  const count = validateTransactions(DATA_PATH);
  console.log(`Validated ${count} transactions`);
  
  const rules = validatePricing(RULES_PAH);  // BUG: typo — RULES_PAH instead of RULES_PATH
  console.log(`Pricing rules v${rules.version} loaded`);
  
  // Process
  const transactions = parseTransactions(DATA_PATH);
  const report = generateReport(transactions, rules);
  
  // Write output
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));
  console.log(`Report written to ${OUTPUT_PATH}`);
  
} catch (err) {
  console.error(`Pipeline failed: ${err.message}`);
  process.exit(1);
}
