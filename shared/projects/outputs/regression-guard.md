# Regression Guard Implementation

## Summary

Added a regression guard to `eval-poller.ts` that checks evaluation throughput at the end of each run. If fewer than 10 evaluations exist in the last 7 days, it writes a P0 alert to `.state/alerts/`.

## What Was Done

1. **Added regression check function** to `agents/may/handlers/eval-poller.ts`
2. **Alert output**: `.state/alerts/eval-regression-{timestamp}.json`
3. **Alert schema**: `{ type: "eval-regression", count, threshold: 10, detectedAt }`
4. **Directory creation**: `.state/alerts/` is created if it doesn't exist

## Implementation Details

The `checkForRegression()` function:
- Scans `.state/evaluations/` for files modified in the last 7 days
- If count < 10, writes a JSON alert file to `.state/alerts/`
- Called at the end of each poller run (every 30 min via cron)
- This ensures silent pipeline failures are detected within hours, not months

## Threshold Rationale

- **10 sessions/7d** is well below the expected ~66 sessions/day (~462/week)
- Crossing this threshold means the pipeline is effectively dead
- Low enough to avoid false positives during quiet weekends
- High enough to catch real outages within 1-2 days

## Alert Format

```json
{
  "type": "eval-regression",
  "count": 3,
  "threshold": 10,
  "detectedAt": "2025-01-15T12:00:00.000Z",
  "message": "Evaluation pipeline regression: only 3 sessions scored in last 7 days (threshold: 10)"
}
```

## Prevention Value

The original 3-month outage went undetected because nobody monitored throughput. This guard ensures any future pipeline breakage triggers a visible alert within hours.
