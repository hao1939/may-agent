#!/bin/bash
# EXP-215 FIXED: Prerequisite Detection Skill — 5 control + 5 treatment
# BUG FIX: --lab flag takes just the fork NAME, not the full path.
# Wrong: --lab agents/.lab/prerequisite-detection-skill (gym prepends agents/.lab/)
# Right: --lab prerequisite-detection-skill
#
# Output: agents/coach/workspace/exp215-fixed-results.jsonl

OUTFILE="agents/coach/workspace/exp215-fixed-results.jsonl"
> "$OUTFILE"

echo "=== EXP-215 (FIXED) Starting at $(date -u) ===" >> "$OUTFILE.log"

# 5 CONTROL runs (default coder, no lab fork)
for i in $(seq 1 5); do
  echo "[$(date -u)] CONTROL run $i/5..." >> "$OUTFILE.log"
  RAW=$(timeout 300 test/gym/run-gym.sh missing-prerequisite-detection 2>&1)
  # Extract passed field from JSON
  PASSED=$(echo "$RAW" | grep -oP '"passed"\s*:\s*(true|false)' | head -1 | grep -oP 'true|false')
  # Extract score fraction from score_summary
  SCORE=$(echo "$RAW" | grep -oP '\d+/\d+' | tail -1)
  SUMMARY=$(echo "$RAW" | grep -oP '"score_summary"\s*:\s*"[^"]*"' | head -1 | sed 's/"score_summary":\s*//;s/^"//;s/"$//')
  echo "{\"exp\":\"EXP-215\",\"condition\":\"control\",\"run\":$i,\"passed\":$PASSED,\"score\":\"$SCORE\",\"summary\":\"$(echo "$SUMMARY" | head -c 200)\"}" >> "$OUTFILE"
  echo "[$(date -u)] CONTROL run $i done: passed=$PASSED score=$SCORE" >> "$OUTFILE.log"
done

# 5 TREATMENT runs (with lab fork — FIXED: just the fork name)
for i in $(seq 1 5); do
  echo "[$(date -u)] TREATMENT run $i/5..." >> "$OUTFILE.log"
  RAW=$(timeout 300 test/gym/run-gym.sh missing-prerequisite-detection --lab prerequisite-detection-skill 2>&1)
  PASSED=$(echo "$RAW" | grep -oP '"passed"\s*:\s*(true|false)' | head -1 | grep -oP 'true|false')
  SCORE=$(echo "$RAW" | grep -oP '\d+/\d+' | tail -1)
  SUMMARY=$(echo "$RAW" | grep -oP '"score_summary"\s*:\s*"[^"]*"' | head -1 | sed 's/"score_summary":\s*//;s/^"//;s/"$//')
  echo "{\"exp\":\"EXP-215\",\"condition\":\"treatment\",\"run\":$i,\"passed\":$PASSED,\"score\":\"$SCORE\",\"summary\":\"$(echo "$SUMMARY" | head -c 200)\"}" >> "$OUTFILE"
  echo "[$(date -u)] TREATMENT run $i done: passed=$PASSED score=$SCORE" >> "$OUTFILE.log"
done

echo "=== EXP-215 (FIXED) Complete at $(date -u) ===" >> "$OUTFILE.log"
echo "DONE" >> "$OUTFILE.log"
