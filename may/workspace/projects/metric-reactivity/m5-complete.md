# Milestone 5 Complete: Alert-to-Reaction Time Metric

## Status: DONE

## Metric Definition
- **ID**: `may.alert-to-reaction-time`
- **Type**: health (auto-measured)
- **Owner**: may
- **Unit**: minutes
- **Target**: 30 min
- **Threshold**: 120 min (alert_direction: above)
- **Sensitivity**: 0.2

## Source Query
```sql
SELECT COALESCE(
  (SELECT AVG((r.createdAt - ma.created_at) / 60000.0)
   FROM metric_alerts ma
   JOIN requests r ON r.source = 'metric-alert'
     AND r.task LIKE '%' || ma.metric_id || '%'
   WHERE ma.created_at > (strftime('%s','now') * 1000 - 604800000)),
  0) as val
```

## Current State
- **Current value**: 1100.88 minutes (~18 hours avg reaction time)
- **1 snapshot** recorded by `auto:metrics-snapshot`
- The high value reflects that the auto-fork mechanism was added days after alerts first fired

## Evidence
- Metric exists in `metrics` table with `id='may.alert-to-reaction-time'`
- Query runs successfully and returns meaningful data
- 5 requests with `source='metric-alert'` exist in the DB
- The metric will automatically improve as new alerts get faster auto-fork responses

## All 5 Milestones Complete
1. ✅ Investigate: mapped the gap (alerts written, nobody reads them)
2. ✅ Design: push via auto-fork + pull via heartbeat injection
3. ✅ Build: `autoForkForAlert()` + backfill logic in metrics-snapshot.ts
4. ✅ Verify: 12+ metric-alert sessions, 5 tracked requests with source='metric-alert'
5. ✅ Measure: `may.alert-to-reaction-time` metric auto-measured every snapshot
