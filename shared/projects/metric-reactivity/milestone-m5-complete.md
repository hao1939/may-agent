# Milestone M5: Alert-to-Reaction Time Metric — COMPLETE

## Evidence

The metric `may.alert-to-reaction-time` already exists in the DB with:
- **type**: health
- **owner**: may  
- **unit**: minutes
- **target**: 30 min
- **threshold**: 120 min (alert if above)
- **current value**: 1100.88 minutes (still high — alerts are being created but responses are slow)
- **alert_direction**: above
- **source_query**:
```sql
SELECT COALESCE((SELECT AVG((r.createdAt - ma.created_at) / 60000.0) 
FROM metric_alerts ma 
JOIN requests r ON r.source = 'metric-alert' AND r.task LIKE '%' || ma.metric_id || '%' 
WHERE ma.created_at > (strftime('%s','now') * 1000 - 604800000)), 0) as val
```

This query measures the average time (in minutes) between alert creation (`metric_alerts.created_at`) and the first agent reaction (`requests.createdAt WHERE source='metric-alert'`), over the last 7 days.

## M4 also verified

5+ requests with `source = 'metric-alert'` exist in the DB, confirming the auto-fork mechanism fires correctly. Agents tech-lead, coach, and may have all been auto-forked in response to alerts.

## All 5 milestones: DONE
