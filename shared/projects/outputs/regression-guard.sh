#!/usr/bin/env bash
# Regression Guard: Alerts if any SOUL.md or context.md grows back above targets
# Run periodically to ensure agent config bloat doesn't return.
# Targets: SOUL.md < 600w, context.md < 450w

SOUL_LIMIT=600
CTX_LIMIT=450
EXIT_CODE=0

echo "=== Agent Config Regression Guard ==="
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

for agent_dir in /app/agents/*/; do
  agent=$(basename "$agent_dir")
  [[ "$agent" == "shared" ]] && continue

  # Check SOUL.md
  if [[ -f "$agent_dir/SOUL.md" ]]; then
    wc=$(wc -w < "$agent_dir/SOUL.md" 2>/dev/null || echo 0)
    if (( wc > SOUL_LIMIT )); then
      echo "❌ FAIL: $agent/SOUL.md = ${wc}w (limit: ${SOUL_LIMIT}w)"
      EXIT_CODE=1
    else
      echo "✅ OK:   $agent/SOUL.md = ${wc}w"
    fi
  fi

  # Check context.md
  if [[ -f "$agent_dir/context.md" ]]; then
    wc=$(wc -w < "$agent_dir/context.md" 2>/dev/null || echo 0)
    if (( wc > CTX_LIMIT )); then
      echo "❌ FAIL: $agent/context.md = ${wc}w (limit: ${CTX_LIMIT}w)"
      EXIT_CODE=1
    else
      echo "✅ OK:   $agent/context.md = ${wc}w"
    fi
  fi
done

echo ""
if (( EXIT_CODE == 0 )); then
  echo "All agents within limits."
else
  echo "⚠️  Some agents exceed word count limits!"
fi
exit $EXIT_CODE
