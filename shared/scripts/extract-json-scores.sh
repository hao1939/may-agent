#!/usr/bin/env bash
# extract-json-scores.sh — Extract JSON scores block from evaluator output
# Usage: echo "$evaluator_output" | ./extract-json-scores.sh
# Returns: extracted JSON on stdout, exit 0 if found, exit 1 if not
#
# Addresses: evaluator JSON retry waste (53 retry sessions/week)
# The evaluator sometimes wraps valid JSON in prose. This extracts it
# before the system triggers an expensive retry session.

input=$(cat)

# Try to extract a JSON object containing "quality" key (the scores block)
json=$(echo "$input" | grep -oP '\{[^{}]*"quality"[^{}]*\}' | head -1)

if [ -n "$json" ]; then
  echo "$json"
  exit 0
fi

# Try multiline: extract between first { and last }
json=$(echo "$input" | sed -n '/^{/,/^}/p' | head -20)
if echo "$json" | grep -q '"quality"'; then
  echo "$json"
  exit 0
fi

exit 1
