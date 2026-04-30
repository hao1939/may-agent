# Top-5 Metrics v2: 7-Day History + 24h Window

## Changes Made

### `agents/may/workspace/tools/top5-metrics.ts`
- Added `--digest` flag: when passed, uses 24h window instead of 6h for session counts
- Added 7-day mini-history line under each metric (Success Rate, Eval Quality, Error Rate, Sessions)
- Handler Health excluded from history (sourced from single snapshot, not time-windowed)

### `agents/may/handlers/daily-digest.ts`
- Now passes `--digest` flag when calling top5-metrics

## Sample Output (with `--digest`)
```
📊 Top 5 Metrics
🟢 Success Rate: 100% →
   7d: - - - - - - 100
🔴 Eval Quality: 0.44 ↑
   7d: 0.20 0.20 0.20 0.20 0.20 0.20 0.44
🟢 Handler Health: 100% →
🟢 Error Rate: 0.1% →
   7d: - - - - - - 0
🟢 Sessions (24h): 2236 ↑
   7d: 0 0 0 0 0 0 2236
```

## Notes
- The 7d history shows daily values from 7 days ago → today (left to right)
- `-` means no data for that day
- Eval Quality at 0.44 🔴 is a real actionable signal — quality scores are low
- The jump from 0.20 → 0.44 shows improvement but still below 0.50 yellow threshold
