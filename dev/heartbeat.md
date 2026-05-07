# Dev Heartbeat

## OUTPUT FORMAT (MANDATORY — EVEN IN WORK SESSIONS)
Your FIRST output must be:
```
GOAL: [one sentence]
PLAN:
1. [action]
2. [action]  
3. [action]
DONE WHEN: [criteria]
```
This format is required in EVERY session — heartbeats, work sessions, project iterations. No exceptions.

## Priority Order
1. **Check work queue**: read `agents/shared/work-queue.md` section "## Approved" — pick top unchecked item and implement it
2. **Check error metrics**: query session.error-rate-6h, handler.success-rate
3. **Find failures**: query recent failed sessions and handler errors
4. **Pick highest-impact**: which failure pattern affects the most sessions?
5. **Investigate**: read session logs, trace the error through code
6. **Fix**: patch the workflow/handler/skill
7. **Verify**: syntax-check, ensure no regressions

## Queries to Start With (when DB access is available)
If you have the `query_db` tool in your environment, these queries are the fastest way to start:
```sql
-- Recent failures
SELECT sessionId, agent, status, error, startedAt FROM sessions WHERE status='error' ORDER BY startedAt DESC LIMIT 5;

-- Handler failures
SELECT event_type, data, timestamp FROM events WHERE event_type='handler.failed' ORDER BY timestamp DESC LIMIT 5;

-- Long/high-op sessions (inefficiency)
-- Caveat: sessions.opCount is currently frozen at 0 in the live runtime (KE-796).
-- Treat an empty result as "opCount unavailable," not proof that no high-op sessions exist.
SELECT sessionId, agent, opCount, startedAt, endedAt, (endedAt - startedAt) AS duration_ms
FROM sessions
WHERE opCount > 10
ORDER BY startedAt DESC
LIMIT 5;

-- Current metrics health
SELECT id, name, current, target, threshold, alert_op, updated_at FROM metrics WHERE status='active';

-- Unmeasured metrics (no recent snapshot)
SELECT m.id, m.name
FROM metrics m
LEFT JOIN metric_snapshots ms
  ON m.id = ms.metric_id
 AND ms.measured_at > (unixepoch()*1000 - 3600000)
WHERE ms.metric_id IS NULL AND m.status='active';
```

## If you do NOT have DB access (fallback that works with bash/read)
Use this fallback to still do a useful heartbeat:

1. **Scan recent investigations** (find recurring failure patterns):
   - `ls -lt agents/*/workspace/investigations | head`
   - `sed -n '1,120p' agents/dev/workspace/investigations/<file>.md`

2. **Search for recent errors in workspace artifacts** (logs, stack traces):
   - `grep -R --line-number --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.state "error" agents/*/workspace | head -200`

3. **Audit for broken instructions** (like missing tools) and fix local docs:
   - Ensure your heartbeat steps only reference tools you actually have.

## Metrics Engineering
If DB access is available, register a new metric with:
```sql
INSERT OR IGNORE INTO metrics (id, name, owner, source_query, target, threshold, alert_op, type, status, speed, created_at, updated_at)
VALUES ('your.metric-id', 'Human-readable name', 'dev',
  'SELECT COUNT(*) as value FROM ...', 10, 3, '<', 'health', 'active', 'fast',
  unixepoch()*1000, unixepoch()*1000);
```
Otherwise, capture the gap as an investigation in `agents/dev/workspace/investigations/` and escalate to May/owner to add the metric.
