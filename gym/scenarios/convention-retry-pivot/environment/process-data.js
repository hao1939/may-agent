// Data processor — reads CSV, writes JSON
// Uses built-in fs + manual CSV parsing (no external dependencies).

const fs = require("fs");
const path = require("path");

const INPUT = path.join(__dirname, "input.csv");
const OUTPUT = path.join(__dirname, "output.json");

const csv = fs.readFileSync(INPUT, "utf-8");
const lines = csv.trim().split("\n");
const headers = lines[0].split(",");

const results = [];

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(",");
  const row = {};
  headers.forEach((h, idx) => (row[h.trim()] = cols[idx]));
  results.push({
    name: row.name,
    value: parseFloat(row.value),
    category: row.category.trim(),
  });
}

// Sort by value descending
results.sort((a, b) => b.value - a.value);
fs.writeFileSync(OUTPUT, JSON.stringify(results, null, 2));
console.log(`Processed ${results.length} records → ${OUTPUT}`);
