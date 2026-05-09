# Iteration 1 deliverable — alert/breach wiring discovery (location + patch plan)

## What was unknown
We were blocked on **where** `evaluator.low-quality-rate-24h` is evaluated against a threshold / used to open alerts.

## Discovery result (confirmed in code)
Alert lifecycle (open on breach, resolve on recovery) is implemented inside:

- **`agents/may/handlers/metrics-snapshot.ts`**
  - Metric registration:
    - `evaluator.low-quality-rate-24h` at lines ~62
    - `evaluator.substantive-low-quality-rate-24h` at lines ~63
  - Metric computation:
    - `record("evaluator.low-quality-rate-24h", ...)` at lines **~388–389**
    - `record("evaluator.substantive-low-quality-rate-24h", ...)` at lines **~410–411**
  - Threshold/breach evaluation + alert open/resolve:
    - Section header: `// ── Alert lifecycle (type-aware: open on breach, resolve on recovery) ───────`
    - It selects all active metrics with `current` and `threshold`, computes `breached`, then upserts `metric_alerts` and emits `metric.breach` / `metric.recovered`.

### Evidence excerpt: metric computation
From `agents/may/handlers/metrics-snapshot.ts` (read at offset ~340):

- Broad metric:
  ```ts
  const total = count(
    "SELECT COUNT(*) as c FROM evaluations WHERE createdAt > ? AND agent NOT IN ('evaluator', 'judge')",
    twentyFourH,
  );
  const needsImprovementOrLowScore = count(
    `SELECT COUNT(*) as c
     FROM evaluations
     WHERE createdAt > ?
       AND agent NOT IN ('evaluator', 'judge')
       AND (verdict IN ('needs_improvement', 'low_quality') OR quality < 0.4 OR efficiency < 0.4)`,
    twentyFourH,
  );
  record("evaluator.low-quality-rate-24h", total > 0 ? parseFloat((needsImprovementOrLowScore / total).toFixed(4)) : 0, total);
  ```

- Substantive-only metric:
  ```ts
  const substantiveLowQuality = count(
    `SELECT COUNT(*) as c
     FROM evaluations e
     LEFT JOIN sessions s ON s.sessionId = e.sessionId
     WHERE e.createdAt > ?
       AND e.agent NOT IN ('evaluator', 'judge')
       AND (
         s.status IN ('error', 'interrupted')
         OR lower(COALESCE(e.issues, '')) LIKE '%tool hallucination%'
         OR lower(COALESCE(e.issues, '')) LIKE '%verification failure%'
         OR lower(COALESCE(e.issues, '')) LIKE '%blind overwrite%'
       )`,
    twentyFourH,
  );
  record("evaluator.substantive-low-quality-rate-24h", total > 0 ? parseFloat((substantiveLowQuality / total).toFixed(4)) : 0, total);
  ```

### Evidence excerpt: alert open/resolve wiring
Same file contains the alert lifecycle loop:

- selects `metrics` rows where `status='active'` and `current`/`threshold` are set
- calculates `breached` based on `alert_op` and type-specific rules
- writes/upserts `metric_alerts`
- emits events:
  - `ctx.sdk.emit("metric.breach", {...})`
  - (later in file) `ctx.sdk.emit("metric.recovered", {...})`

This means the system does **not** have a separate “alerting service” to locate; **metrics-snapshot is the breach source-of-truth**.

## Why this unblocks the goal
We can now change the alert semantics in exactly one place:

- either by changing which metric is considered the “quality breach” metric (rename/threshold/priority)
- or by changing the threshold values so the substantive metric pages and the broad metric does not.

## Minimal patch plan (surgical)
Goal: keep the separation between (a) fixable agent quality failures and (b) pipeline/guard false penalties, while ensuring we do **not** inflate “false-good”.

### Option A (recommended): pivot paging attention to substantive metric
In `agents/may/handlers/metrics-snapshot.ts` in `ALL_METRICS`:

- Make `evaluator.substantive-low-quality-rate-24h` the primary alert:
  - keep threshold at `0.30` (or tighten after observing stability)
  - set priority higher (e.g. P1) if we truly want paging
- Downgrade broad metric to friction-only:
  - raise its threshold (e.g. from 0.30 → 0.40 or 0.50), or lower its priority

This does **not** hide pipeline problems: the broad metric remains visible, just not used as the primary “quality collapse” page.

### Option B: introduce explicit unscorable tracking (future)
If we later add an `unknown/unscorable` verdict to evaluations, we can:

- exclude those from broad metric denominator
- add a new metric `evaluator.unscorable-rate-24h`

…but this requires changes to evaluator scoring + schema conventions; Option A works immediately with current schema.

## Next steps / verification queries
Once the thresholds/priorities are changed:

1. Confirm `metrics` registry matches desired threshold/priority.
2. After next metrics snapshot run, confirm:
   - `metric_alerts` shows breach/resolution on the intended metric id.

DB checks:

```sql
SELECT id, current, threshold, target, alert_op, priority, updated_at
FROM metrics
WHERE id IN (
  'evaluator.low-quality-rate-24h',
  'evaluator.substantive-low-quality-rate-24h'
);

SELECT id, metric_id, alert_type, message, created_at, resolved_at
FROM metric_alerts
WHERE metric_id IN (
  'evaluator.low-quality-rate-24h',
  'evaluator.substantive-low-quality-rate-24h'
)
ORDER BY created_at DESC
LIMIT 20;
```
