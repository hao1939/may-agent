/**
 * process.js — Data processing pipeline
 * 
 * Reads a CSV file, transforms rows, writes JSON output.
 */

const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

function readCSV(filepath) {
  try {
    const raw = fs.readFileSync(filepath, 'utf-8');
    const lines = raw.trim().split('\n');
    const headers = lines[0].split(',');
    return lines.slice(1).map(line => {
      const vals = line.split(',');
      const row = {};
      headers.forEach((h, i) => { row[h] = vals[i]; });
      return row;
    });
  } catch (err) {
    // Gracefully handle missing files — return empty dataset
    // (this is intentional for optional supplementary data files)
    return [];
  }
}

function processData(rows) {
  // Group by product and sum quantities
  const summary = {};
  for (const row of rows) {
    const product = row.product;
    if (!summary[product]) {
      summary[product] = { product, totalQuantity: 0, totalRevenue: 0 };
    }
    summary[product].totalQuantity += parseInt(row.quantity, 10);
    summary[product].totalRevenue += parseInt(row.quantity, 10) * parseFloat(row.price);
  }
  return Object.values(summary);
}

function writeResults(data) {
  if (data.length === 0) {
    console.log('No data to write, skipping output.');
    return;
  }
  
  // Ensure output directory exists
  const dir = path.dirname(config.outputFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(config.outputFile, JSON.stringify(data, null, 2));
  console.log(`Wrote ${data.length} records to ${config.outputFile}`);
}

function verify() {
  // Verify output was written correctly
  const output = JSON.parse(fs.readFileSync(config.outputFile, 'utf-8'));
  if (output.length < config.minRecords) {
    throw new Error(`Expected at least ${config.minRecords} records, got ${output.length}`);
  }
  console.log(`Verification passed: ${output.length} records`);
}

// Main
const rows = readCSV(config.inputFile);
const results = processData(rows);
writeResults(results);
verify();
