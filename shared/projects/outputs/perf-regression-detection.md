# Performance Regression Detection

## Summary
Added performance regression detection to `scripts/nightly-health.sh`. The script now:
1. Runs vitest and parses the Duration line from output
2. Compares against a 5-second threshold
3. Prints `⚠️ PERF REGRESSION` warning if exceeded
4. Exits with code 2 (distinct from code 1 for test failures)

## Changes Made
**File**: `agents/shared/scripts/nightly-health.sh`

### Added Logic (after system health check)
```bash
# Performance regression detection
PERF_THRESHOLD=5
VITEST_OUTPUT=$(npx vitest run 2>&1) || true
DURATION=$(echo "$VITEST_OUTPUT" | grep -oP 'Duration\s+\K[\d.]+' | head -1)
if [ -n "$DURATION" ]; then
  DURATION_INT=${DURATION%.*}
  if [ "${DURATION_INT:-0}" -ge "$PERF_THRESHOLD" ]; then
    PERF_WARNING="⚠️ PERF REGRESSION: tests took ${DURATION}s (threshold: ${PERF_THRESHOLD}s)"
    EXIT_CODE=2
  fi
fi
```

### Exit Code Semantics
| Code | Meaning |
|------|---------|
| 0 | All healthy, performance OK |
| 1 | Test failures detected |
| 2 | Performance regression (tests > 5s) |

## Verification
Current test runtime is well under 5s (typically ~0.4s), so the check passes cleanly.

