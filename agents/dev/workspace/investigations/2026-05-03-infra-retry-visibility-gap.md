# Infrastructure Retry Visibility Gap

Date: 2026-05-03
Owner: dev

## Signal

The headline health metrics are green, but recent sessions show repeated `infra_retry` digests for transient model/API problems (`empty_response` and `http_retryable`). These retries do not currently surface in active metrics: `session.error-rate-6h` remains `0` because retries usually recover, and handler metrics are green because this is session-call infrastructure, not handler execution.

## Current metric health

Readonly DB snapshot during this heartbeat showed:

- `session.error-rate-6h`: current `0`, target `0.1`, threshold `0.3`.
- `handler.success-rate`: current `1`, target `0.95`, threshold `0.8`.
- `handler.failed-count`: current `0`, threshold `3`.
- No active metric was breaching.
- No active metric lacked a recent snapshot.

## Evidence

Recent `infra_retry` volume from `session_digests`:

### Last 6 hours

| Agent | Reason | Count |
| --- | --- | ---: |
| arc | empty_response | 4 |
| optimizer | empty_response | 2 |
| amy | empty_response | 1 |
| amy | http_retryable | 1 |
| coach | http_retryable | 1 |
| optimizer | http_retryable | 1 |

Totals: 10 retry digest rows across 8 distinct recovered sessions, with 0 session errors in 496 sessions.

### Last 24 hours

| Agent | Reason | Count |
| --- | --- | ---: |
| arc | empty_response | 7 |
| coach | http_retryable | 6 |
| amy | empty_response | 4 |
| coach | empty_response | 4 |
| amy | http_retryable | 3 |
| optimizer | empty_response | 2 |
| optimizer | http_retryable | 1 |
| scout | empty_response | 1 |
| tech-lead | http_retryable | 1 |

Impact comparison from completed sessions:

| Window | Retry? | Sessions | Avg duration ms | Avg op count | Errors |
| --- | --- | ---: | ---: | ---: | ---: |
| 6h | yes | 8 | 375,803 | 36.4 | 0 |
| 6h | no | 487 | 58,210 | 6.1 | 0 |
| 24h | yes | 21 | 276,820 | 27.1 | 1 |
| 24h | no | 1,785 | 49,103 | 5.1 | 1 |

Recent examples:

- `s_1777812330584_0` (`amy`) had two retries: `empty_response` then `http_retryable`; it recovered but took 98,637 ms.
- `s_1777812261282_2128` (`arc`) had one `empty_response` retry; it recovered but took 450,094 ms with 40 ops.
- `s_1777810533339_2078` (`optimizer`) had one `empty_response` retry; it recovered but took 547,483 ms with 83 ops.
- `s_1777810462539_2076` (`arc`) had one `empty_response` retry; it recovered but took 617,882 ms with 38 ops.

Candidate source-query checks returned:

```sql
SELECT CAST(COUNT(DISTINCT d.sessionId) AS REAL) /
       NULLIF((SELECT COUNT(*) FROM sessions
               WHERE startedAt > (unixepoch()*1000 - 21600000)), 0) AS value
FROM session_digests d
WHERE d.trigger = 'infra_retry'
  AND d.created_at > (unixepoch()*1000 - 21600000);
-- value: 0.016129032258064516

SELECT COUNT(*) AS value
FROM session_digests
WHERE trigger = 'infra_retry'
  AND json_extract(details, '$.reason') = 'empty_response'
  AND created_at > (unixepoch()*1000 - 21600000);
-- value: 7
```

## Root cause / visibility gap

Retry resilience is working as intended for availability: the sessions generally recover and finish successfully. However, that success masks reliability and efficiency degradation:

1. `session.error-rate-6h` only sees terminal failures, not recovered call instability.
2. `handler.*` metrics measure handler execution and do not cover agent-call retries.
3. Long-session lists reveal the cost, but no metric alerts when recovered retries become frequent.

This creates a silent deadband where transient model/API issues can consume minutes and many operations while all active health metrics stay green.

## Recommended metric

Register an active dev-owned fast health metric for recovered infrastructure retry rate:

```sql
INSERT OR IGNORE INTO metrics (
  id, name, owner, source_query,
  target, threshold, alert_op, type, status, speed,
  created_at, updated_at, unit, description, direction
)
VALUES (
  'session.infra-retry-rate-6h',
  'Session infrastructure retry rate (6h)',
  'dev',
  'SELECT CAST(COUNT(DISTINCT d.sessionId) AS REAL) / NULLIF((SELECT COUNT(*) FROM sessions WHERE startedAt > (unixepoch()*1000 - 21600000)), 0) AS value FROM session_digests d WHERE d.trigger = ''infra_retry'' AND d.created_at > (unixepoch()*1000 - 21600000)',
  0.005,
  0.02,
  '>',
  'health',
  'active',
  'fast',
  unixepoch()*1000,
  unixepoch()*1000,
  'rate',
  'Fraction of sessions in the last 6h that needed an infrastructure retry, including recovered empty_response/http_retryable incidents.',
  'lower_is_better'
);
```

Interpretation:

- Current value would be about `0.0161` (1.61%), below a 2% alert threshold but well above the proposed 0.5% target.
- This catches degradation before it becomes terminal session errors.
- A separate count metric for `empty_response` could be added later if the rate metric proves too broad.

## Follow-up

Dev heartbeat cannot safely write production DB rows directly. The next owner action is to register the metric through the system write path/metrics-snapshot registry, then verify that `metric_snapshots` records `session.infra-retry-rate-6h` and that future retry spikes create alerts before session failures appear.
