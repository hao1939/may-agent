#!/usr/bin/env bash
# Run all 12 control arm scenarios for EXP-107 and collect FM-3.3 metrics
# Usage: run-control-arm.sh

set -euo pipefail
export PATH=".state/.bun/bin:$PATH"

SCENARIOS=("verify-before-finish" "compound-edit-verification" "multi-file-verify-gap" "convention-verify-edit")
REPS=3
RESULTS_DIR="agents/.lab/exp107-adversarial-finish/control-results"
mkdir -p "$RESULTS_DIR"

echo "scenario,rep,finish_calls,fm33_blocks,total_ops,first_try_success,product_pass,duration_ms,session_id" > "$RESULTS_DIR/control-arm.csv"

count=0
total=$((${#SCENARIOS[@]} * REPS))

for scenario in "${SCENARIOS[@]}"; do
  for rep in $(seq 1 $REPS); do
    count=$((count + 1))
    echo "=== [$count/$total] $scenario / rep $rep ==="
    
    # Run the gym scenario
    RESULT=$(scripts/gym-run.sh "$scenario" --agent coder 2>&1) || true
    
    # Extract session path
    SESSION_PATH=$(echo "$RESULT" | grep -o '"session_path": "[^"]*"' | head -1 | sed 's/"session_path": "//;s/"$//')
    SESSION_ID=$(echo "$RESULT" | grep -o '"session_id": "[^"]*"' | head -1 | sed 's/"session_id": "//;s/"$//')
    DURATION=$(echo "$RESULT" | grep -o '"duration_ms": [0-9]*' | head -1 | sed 's/"duration_ms": //')
    
    # Extract product pass
    PRODUCT_PASS=$(echo "$RESULT" | grep -o '"passed": [a-z]*' | head -1 | sed 's/"passed": //')
    
    if [ -n "$SESSION_PATH" ] && [ -d "$SESSION_PATH" ]; then
      TRANSCRIPT="$SESSION_PATH/session.jsonl"
      RECEIPTS="$SESSION_PATH/receipts.jsonl"
      
      # Count finish calls
      FINISH_CALLS=$(grep -o '"name":"finish"' "$TRANSCRIPT" 2>/dev/null | wc -l | tr -d ' ')
      
      # Count FM-3.3 guard blocks (the exact string from the guard)
      FM33_BLOCKS=$(grep -c 'blocked \[FM-3.3\]' "$TRANSCRIPT" 2>/dev/null) || FM33_BLOCKS=0
      
      # Count total ops from receipts
      TOTAL_OPS=0
      if [ -f "$RECEIPTS" ]; then
        TOTAL_OPS=$(wc -l < "$RECEIPTS" | tr -d ' ')
      fi
      
      # First-try success
      FIRST_TRY="false"
      if [ "$FINISH_CALLS" -ge 1 ] && [ "$FM33_BLOCKS" -eq 0 ]; then
        FIRST_TRY="true"
      fi
      
      echo "$scenario,$rep,$FINISH_CALLS,$FM33_BLOCKS,$TOTAL_OPS,$FIRST_TRY,$PRODUCT_PASS,$DURATION,$SESSION_ID" >> "$RESULTS_DIR/control-arm.csv"
      echo "  → finish=$FINISH_CALLS fm33_blocks=$FM33_BLOCKS ops=$TOTAL_OPS first_try=$FIRST_TRY pass=$PRODUCT_PASS"
    else
      echo "$scenario,$rep,0,0,0,false,false,0,unknown" >> "$RESULTS_DIR/control-arm.csv"
      echo "  → ERROR: no session path found"
    fi
    
    # Save full result JSON
    echo "$RESULT" > "$RESULTS_DIR/${scenario}-rep${rep}.json"
  done
done

echo ""
echo "=== CONTROL ARM COMPLETE ==="
cat "$RESULTS_DIR/control-arm.csv"
