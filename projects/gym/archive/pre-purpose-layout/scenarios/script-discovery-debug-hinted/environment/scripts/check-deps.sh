#!/bin/bash
# check-deps.sh — Validate data file format and check for anomalies
#
# Checks input data files for format issues, missing fields, or
# suspicious values that might cause pipeline errors.
#
# Usage: ./scripts/check-deps.sh [data-file]
#   data-file: path to JSON data file (default: data/input.json)

datafile="${1:-data/input.json}"

if [ ! -f "$datafile" ]; then
  echo "Error: $datafile not found"
  exit 1
fi

echo "╔══════════════════════════════════════════════════════╗"
echo "║           Data Validation Report                     ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "File: $datafile"
echo "Size: $(wc -c < "$datafile") bytes"
echo ""

# Check if valid JSON
if ! node -e "JSON.parse(require('fs').readFileSync('$datafile','utf-8'))" 2>/dev/null; then
  echo "ERROR: Invalid JSON format"
  exit 1
fi

echo "━━━ Record Summary ━━━"
node -e "
const data = JSON.parse(require('fs').readFileSync('$datafile','utf-8'));
console.log('Total records: ' + data.length);
console.log('');

// Check categories
const cats = {};
data.forEach(r => { cats[r.category] = (cats[r.category]||0) + 1; });
console.log('Categories:');
Object.entries(cats).forEach(([k,v]) => console.log('  ' + k + ': ' + v));
console.log('');

// Check for decimal amounts (potential truncation risk)
const decimalAmounts = data.filter(r => r.amount && r.amount.includes('.') && r.amount.split('.')[1] !== '00');
console.log('Records with decimal amounts: ' + decimalAmounts.length + '/' + data.length);
if (decimalAmounts.length > 0) {
  console.log('  Examples: ' + decimalAmounts.slice(0,3).map(r => r.name + '=' + r.amount).join(', '));
  console.log('  ⚠ Ensure numeric parsing preserves decimal precision');
}
console.log('');

// Check for missing fields
const required = ['id','name','category','amount','quantity'];
const missing = data.filter(r => required.some(f => !r[f]));
if (missing.length > 0) {
  console.log('⚠ Records with missing fields: ' + missing.length);
  missing.forEach(r => console.log('  Record ' + r.id + ': missing ' + required.filter(f => !r[f]).join(', ')));
} else {
  console.log('✓ All records have required fields');
}
"
