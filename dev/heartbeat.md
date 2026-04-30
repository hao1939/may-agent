# Dev Heartbeat

## Priority Order
1. **Check error metrics**: query session.error-rate-6h, handler.success-rate
2. **Find failures**: query recent failed sessions and handler errors
3. **Pick highest-impact**: which failure pattern affects the most sessions?
4. **Investigate**: read session logs, trace the error through code
5. **Fix**: patch the workflow/handler/skill
6. **Verify**: syntax-check, ensure no regressions

## Queries to Start With
```sql
-- Recent failures
SELECT id, agent, status, error FROM sessions WHERE status='error' ORDER BY startedAt DESC LIMIT 5;

-- Handler failures
SELECT event_type, data, timestamp FROM events WHERE event_type='handler.failed' ORDER BY timestamp DESC LIMIT 5;

-- Long sessions (inefficiency)
SELECT id, agent, turns, duration_ms FROM sessions WHERE turns > 10 ORDER BY startedAt DESC LIMIT 5;

-- Current metrics health
SELECT id, name, current, target, threshold, alert_op, updated_at FROM metrics WHERE status='active';

-- Unmeasured metrics (no recent snapshot)
SELECT m.id, m.name FROM metrics m LEFT JOIN metric_snapshots ms ON m.id = ms.metric_id AND ms.measured_at > (unixepoch()*1000 - 3600000) WHERE ms.metric_id IS NULL AND m.status='active';
```

## Metrics Engineering
When you find a gap, register a new metric:
```sql
INSERT OR IGNORE INTO metrics (id, name, owner, source_query, target, threshold, alert_op, type, status, speed, created_at, updated_at)
VALUES ('your.metric-id', 'Human-readable name', 'dev',
  'SELECT COUNT(*) as value FROM ...', 10, 3, '<', 'health', 'active', 'fast',
  unixepoch()*1000, unixepoch()*1000);
```
The metrics-snapshot handler will auto-measure it every 5 minutes.
