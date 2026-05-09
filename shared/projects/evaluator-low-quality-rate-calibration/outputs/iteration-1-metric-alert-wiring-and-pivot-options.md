# Iteration 1 — metric alert wiring discovery + pivot options

## What we needed to know
We were blocked on **where** `evaluator.low-quality-rate-24h` is evaluated against a threshold / used to open alerts.

## Discovery (in-repo wiring)
Alert thresholding + alert open/resolve for metrics is implemented **in repo** in:

- `agents/may/handlers/metrics-snapshot.ts`

This file does **both**:
1) defines/refreshes metric registry metadata (including `threshold`, `alert_op`, `priority`)
2) computes `current` + writes `metric_snapshots`
3) evaluates breach conditions and writes `metric_alerts` + emits `metric.breach` / `metric.recovered`

### Evidence: metric registry contains both metrics
In `ALL_METRICS` (near top of file), both the broad metric and substantive metric exist:

```ts
{ id: "evaluator.low-quality-rate-24h", name: "Broad needs-improvement/low-score evaluated sessions (24h)", owner: "evaluator", type: "gauge", target: 0.10, threshold: 0.30, unit: "ratio", alert_op: ">", priority: "P2" },
{ id: "evaluator.substantive-low-quality-rate-24h", name: "Substantive evaluator quality failures (24h)", owner: "evaluator", type: "gauge", target: 0.10, threshold: 0.30, unit: "ratio", alert_op: ">", priority: "P2" },
```

### Evidence: metric computation SQL exists for both
In the measurement section:

- Broad low-quality rate:
```ts
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

- Substantive low-quality rate:
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

### Evidence: breach/alert lifecycle is inside the same handler
Still in `metrics-snapshot.ts`, the alert loop:

- loads any open alert for each metric
- computes `breached`
- **inserts/updates** `metric_alerts`
- emits `metric.breach` and `metric.recovered`

Key excerpt:

```ts
if (breached) {
  if (!openAlert) {
    db.run(
      "INSERT INTO metric_alerts (metric_id, alert_type, message, created_at) VALUES (?, ?, ?, ?)",
      [m.id, alertType, message, now]
    );
    ctx.sdk.emit("metric.breach", { owner, metricId: m.id, ... });
  }
} else if (openAlert) {
  db.run("UPDATE metric_alerts SET resolved_at = ? WHERE id = ?", [now, openAlert.id]);
  ctx.sdk.emit("metric.recovered", { metricId: m.id, metricName: m.name });
}
```

## Why this unblocks the project
We now have an **operational wiring location** that can be patched (surgically) to:
- keep the broad metric as a *secondary ops/hygiene* signal
- shift paging/primary thresholding semantics to the substantive metric
- optionally add explicit pipeline/unscorable metrics without conflating them into “low quality”

## Pivot options (guard-safe, minimal-diff)
All options below are changes in **one file**: `agents/may/handlers/metrics-snapshot.ts`.

### Option A (preferred): page on substantive metric, keep broad metric as non-paging
Goal: reduce false-penalties/false paging while still tracking broad hygiene failures.

Minimal steps:
1) Change the broad metric’s `priority` to `P3` (or leave P2 but treat as informational elsewhere).
2) **Disable threshold alerting** for `evaluator.low-quality-rate-24h` by setting threshold to a non-breaching value (e.g., `threshold: 1.0`) *or* by adding a config flag and skipping it in the alert loop.
3) Keep `evaluator.substantive-low-quality-rate-24h` threshold at `0.30` and priority `P2`.

Why this does not create false-good inflation:
- we are not suppressing evidence; we keep the broad metric recorded
- the paging signal becomes tied to “substantive failures” categories

### Option B: keep both paging but clarify semantics
If policy requires broad metric to page:
- keep broad threshold as-is
- also page on substantive metric
- update metric `name` strings + steward messaging to ensure operators understand the difference

This does not reduce `evaluator.low-quality-rate-24h`, but it reduces operator confusion.

### Option C: redefine broad metric semantics (policy-heavy)
Adjust the computation of `evaluator.low-quality-rate-24h` numerator to exclude pipeline/hygiene-only verdicts.

This would likely reduce the metric directly but is essentially a redefinition of the metric.

## Hygiene note (to avoid finish-guard regressions)
This iteration produced a deliverable **only under**:
`agents/shared/projects/evaluator-low-quality-rate-calibration/outputs/`

No project/journal edits are required to apply Option A/B/C.
