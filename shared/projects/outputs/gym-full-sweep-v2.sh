#!/bin/bash
# Full gym sweep v2 — accurate JSON parsing, no grep hacks
# Outputs TSV: scenario | classification | passed | total | error

SCENARIOS_DIR="/app/agents/gym/scenarios"
OUTPUT_TSV="/app/agents/shared/projects/gym-quality-improvement/sweep-v2-raw.tsv"

echo -e "scenario\tclassification\tpassed\ttotal\terror" > "$OUTPUT_TSV"

for dir in "$SCENARIOS_DIR"/*/; do
  scenario=$(basename "$dir")
  
  # Check for success_criteria.js
  if [ ! -f "$dir/success_criteria.js" ]; then
    echo -e "${scenario}\tNO_CRITERIA\t0\t0\tno success_criteria.js" >> "$OUTPUT_TSV"
    continue
  fi
  
  # Check for environment/
  if [ ! -d "$dir/environment" ]; then
    echo -e "${scenario}\tNO_ENVIRONMENT\t0\t0\tno environment/ dir" >> "$OUTPUT_TSV"
    continue
  fi
  
  # Run criteria
  raw=$(cd "$dir/environment" && timeout 15 node ../success_criteria.js . 2>&1)
  exit_code=$?
  
  if [ $exit_code -eq 124 ]; then
    echo -e "${scenario}\tTIMEOUT\t0\t0\ttimeout after 15s" >> "$OUTPUT_TSV"
    continue
  fi
  
  # Parse JSON from output — try full output first, then find JSON substring
  result=$(echo "$raw" | node -e "
    const text = require('fs').readFileSync('/dev/stdin','utf8').trim();
    // Try to find JSON object with checks array
    // Strategy: find last '{' that starts a valid JSON object
    function tryParse(s) {
      try {
        const d = JSON.parse(s);
        const checks = d.checks || (Array.isArray(d) ? d : null);
        if (checks && Array.isArray(checks)) {
          const passed = checks.filter(c => c.passed).length;
          return passed + '\t' + checks.length;
        }
      } catch(e) {}
      return null;
    }
    // Try full text
    let r = tryParse(text);
    if (r) { console.log(r); process.exit(0); }
    // Try from each '{' position
    for (let i = text.lastIndexOf('{'); i >= 0; i = text.lastIndexOf('{', i-1)) {
      // Find matching closing brace
      for (let j = text.indexOf('}', i); j >= 0; j = text.indexOf('}', j+1)) {
        r = tryParse(text.substring(i, j+1));
        if (r) { console.log(r); process.exit(0); }
      }
    }
    // Try as array
    for (let i = text.lastIndexOf('['); i >= 0; i = text.lastIndexOf('[', i-1)) {
      for (let j = text.indexOf(']', i); j >= 0; j = text.indexOf(']', j+1)) {
        r = tryParse(text.substring(i, j+1));
        if (r) { console.log(r); process.exit(0); }
      }
    }
    console.log('NO_JSON\t0');
  " 2>/dev/null)
  
  passed=$(echo "$result" | cut -f1)
  total=$(echo "$result" | cut -f2)
  
  if [ "$passed" = "NO_JSON" ]; then
    # Grab first 80 chars of output as error context
    err=$(echo "$raw" | head -1 | cut -c1-80)
    echo -e "${scenario}\tBROKEN\t0\t0\t${err}" >> "$OUTPUT_TSV"
  elif [ "$total" = "0" ]; then
    echo -e "${scenario}\tEMPTY_CHECKS\t0\t0\tJSON but no checks" >> "$OUTPUT_TSV"
  elif [ "$passed" = "$total" ]; then
    echo -e "${scenario}\tALL_PASS\t${passed}\t${total}\t" >> "$OUTPUT_TSV"
  elif [ "$passed" = "0" ]; then
    echo -e "${scenario}\tALL_FAIL\t0\t${total}\t" >> "$OUTPUT_TSV"
  else
    echo -e "${scenario}\tMIXED\t${passed}\t${total}\t" >> "$OUTPUT_TSV"
  fi
done

# Summary
echo ""
echo "=== SWEEP V2 SUMMARY ==="
total_scenarios=$(tail -n +2 "$OUTPUT_TSV" | wc -l)
echo "Total scenarios: $total_scenarios"
for cls in NO_CRITERIA NO_ENVIRONMENT TIMEOUT BROKEN EMPTY_CHECKS ALL_PASS ALL_FAIL MIXED; do
  count=$(tail -n +2 "$OUTPUT_TSV" | awk -F'\t' -v c="$cls" '$2==c' | wc -l)
  [ "$count" -gt 0 ] && echo "  $cls: $count"
done
