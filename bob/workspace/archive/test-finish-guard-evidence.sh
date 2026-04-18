#!/bin/bash
# Test 1: Fail - claim success with no evidence
bun src/app/may.ts --oneshot --agent bob --task "echo hello" | grep -q "verification_evidence"
if [ $? -eq 0 ]; then
  echo "Test 1 FAIL: finish() should have failed without evidence, but grep found it"
else
  echo "Test 1 PASS: finish() failed or grep didn't find evidence (expected)"
fi
