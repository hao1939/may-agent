#!/bin/bash
# EXP-215: Prerequisite Detection Skill — 5 control + 5 treatment
# Output: agents/coach/workspace/exp215-results.jsonl

OUTFILE="agents/coach/workspace/exp215-results.jsonl"
> "$OUTFILE"

echo "=== EXP-215 Starting at $(date -u) ===" >> "$OUTFILE.log"

# 5 CONTROL runs (default coder)
for i in $(seq 1 5); do
  echo "[$(date -u)] CONTROL run $i/5..." >> "$OUTFILE.log"
  RESULT=$(timeout 300 test/gym/run-gym.sh missing-prerequisite-detection 2>&1 | tail -5)
  PASS=$(echo "$RESULT" | grep -oP '\d+/\d+' | tail -1)
  echo "{\"exp\":\"EXP-215\",\"condition\":\"control\",\"run\":$i,\"result\":\"$PASS\",\"raw\":\"$(echo "$RESULT" | tr '\n' ' ' | sed 's/"/\\"/g')\"}" >> "$OUTFILE"
  echo "[$(date -u)] CONTROL run $i done: $PASS" >> "$OUTFILE.log"
done

# 5 TREATMENT runs (with lab fork)
for i in $(seq 1 5); do
  echo "[$(date -u)] TREATMENT run $i/5..." >> "$OUTFILE.log"
  RESULT=$(timeout 300 test/gym/run-gym.sh missing-prerequisite-detection --lab agents/.lab/prerequisite-detection-skill 2>&1 | tail -5)
  PASS=$(echo "$RESULT" | grep -oP '\d+/\d+' | tail -1)
  echo "{\"exp\":\"EXP-215\",\"condition\":\"treatment\",\"run\":$i,\"result\":\"$PASS\",\"raw\":\"$(echo "$RESULT" | tr '\n' ' ' | sed 's/"/\\"/g')\"}" >> "$OUTFILE"
  echo "[$(date -u)] TREATMENT run $i done: $PASS" >> "$OUTFILE.log"
done

echo "=== EXP-215 Complete at $(date -u) ===" >> "$OUTFILE.log"
echo "DONE" >> "$OUTFILE.log"
