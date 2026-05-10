# Dev error-rate message recheck — 2026-05-10

## Trigger

May sent a P1 FYI saying dev had 68 error sessions in the last 6h and a 15% error rate, highest of any agent.

## Read-only validation

Heartbeat rechecked the live `sessions` table with a 6h window using `query_db`.

Dev-only status distribution:

```sql
SELECT status, COUNT(*) AS n
FROM sessions
WHERE agent='dev'
  AND startedAt > (unixepoch()*1000 - 21600000)
GROUP BY status
ORDER BY n DESC;
```

Result at heartbeat time: `done=15`, `interrupted=1`, `running=1`, and no `error` rows.

Dev-only error-rate check:

```sql
SELECT COUNT(*) AS total,
       SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) AS errors,
       ROUND(1.0*SUM(CASE WHEN status='error' THEN 1 ELSE 0 END)/COUNT(*),4) AS error_rate
FROM sessions
WHERE agent='dev'
  AND startedAt > (unixepoch()*1000 - 21600000);
```

Result at heartbeat time: `total=17`, `errors=0`, `error_rate=0`.

Cross-agent 6h comparison:

```sql
SELECT agent,
       COUNT(*) AS total,
       SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) AS errors,
       ROUND(1.0*SUM(CASE WHEN status='error' THEN 1 ELSE 0 END)/COUNT(*),4) AS error_rate
FROM sessions
WHERE startedAt > (unixepoch()*1000 - 21600000)
GROUP BY agent
ORDER BY errors DESC, error_rate DESC;
```

Result at heartbeat time: evaluator had 2 errors, scout had 1 error, dev had 0 errors.

## Judgment

The P1 message's dev-specific error-count claim is stale or misattributed in the current runtime DB. No dev error-session investigation is indicated from this signal. Continue normal heartbeat monitoring unless a fresh DB query shows dev errors.
