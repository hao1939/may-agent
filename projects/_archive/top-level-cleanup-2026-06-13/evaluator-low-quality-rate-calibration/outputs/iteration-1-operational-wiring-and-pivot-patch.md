# Iteration 1 — Operational wiring + pivot patch (guard-safe)

## Goal
Reduce noisy paging / “false-penalty treated as low quality” by separating **(a) fixable agent behavior failures** from **(b) pipeline/guard false-penalties**, and ensure the evaluator’s scoring produces low false-good overturns.

This iteration closes the operational-wiring gap: **where `evaluator.low-quality-rate-24h` becomes an alert** and what minimal patch would repoint that alerting pressure to `evaluator.substantive-low-quality-rate-24h`.

---

## 1) Evidence: in-repo consumer (thresholding + alert emit)

The alerting path is in-repo:

- Metric is defined + measured in **`agents/may/handlers/metrics-snapshot.ts`**.
- When a metric breaches its threshold, `metrics-snapshot.ts` writes/updates `metric_alerts` and emits a **`metric.breach`** event.
- `agents/may/cron.json` runs **`metric-alert-reactor`** which listens for `metric.breach` and routes to `metric-alert-triage`.

Repo evidence:
- `agents/may/handlers/metrics-snapshot.ts` contains:
  - registry entries for both metrics (see excerpt below)
  - `INSERT INTO metric_alerts ...` and `ctx.sdk.emit("metric.breach", ...)`
- `agents/may/handlers/metric-alert-reactor.ts` is explicitly documented as reacting to `metric.breach`.

### Registry excerpt (ground truth)
From `agents/may/handlers/metrics-snapshot.ts` (around the `ALL_METRICS` registry):

```ts
{ id: "evaluator.low-quality-rate-24h", name: "Broad needs-improvement/low-score evaluated sessions (24h)", owner: "evaluator", type: "gauge", target: 0.10, threshold: 0.30, unit: "ratio", alert_op: ">", priority: "P2" },
{ id: "evaluator.substantive-low-quality-rate-24h", name: "Substantive evaluator quality failures (24h)", owner: "evaluator", type: "gauge", target: 0.10, threshold: 0.30, unit: "ratio", alert_op: ">", priority: "P2" },
```

---

## 2) Runtime proof: both metrics are active in DB right now

DB query:

```sql
SELECT id, current, target, threshold, priority, alert_op, status
FROM metrics
WHERE id IN (
  'evaluator.low-quality-rate-24h',
  'evaluator.substantive-low-quality-rate-24h'
)
ORDER BY id;
```

Observed (2026-05-09):
- `evaluator.low-quality-rate-24h`: current **0.6792**, threshold 0.30, priority **P2** (breaching)
- `evaluator.substantive-low-quality-rate-24h`: current **0.0812**, threshold 0.30, priority **P2** (not breaching)

Implication: **we can reduce false “quality regression” paging immediately by making the broad metric non-paging (or lower priority) and leaving the substantive metric as paging-worthy.**

---

## 3) Minimal patch option (surgical): downgrade broad metric priority

### Patch intent
Keep tracking `evaluator.low-quality-rate-24h` for hygiene visibility, but stop it from generating high-attention triage sessions. Make the substantive metric the one that pages.

### Code change
In `agents/may/handlers/metrics-snapshot.ts` within `ALL_METRICS`, change only the `priority` for `evaluator.low-quality-rate-24h`:

**Before**
```ts
{ id: "evaluator.low-quality-rate-24h", /* ... */ priority: "P2" },
{ id: "evaluator.substantive-low-quality-rate-24h", /* ... */ priority: "P2" },
```

**After (recommended)**
```ts
{ id: "evaluator.low-quality-rate-24h", /* ... */ priority: "P3" },
{ id: "evaluator.substantive-low-quality-rate-24h", /* ... */ priority: "P2" },
```

### Why this is safe
- Does **not** change the computation.
- Does **not** hide the metric.
- Reduces operator load and reduces the likelihood of “false-good overturn” pressure due to hygiene-only NI.

### Operational note
Depending on `metric-alert-reactor` behavior, a P3 metric might still be triaged but deferred; if P3 still causes unwanted triage, the next minimal step is to add a `config.alert.enabled=false` gate or an explicit “do not emit metric.breach if priority is P3” rule in `metrics-snapshot.ts` (policy choice).

---

## 4) Verification plan (post-merge)

After the change lands and the next metrics snapshot runs:

1) Confirm metric metadata changed:
```sql
SELECT id, priority, threshold, alert_op, updated_at
FROM metrics
WHERE id IN ('evaluator.low-quality-rate-24h','evaluator.substantive-low-quality-rate-24h');
```

2) Confirm alert routing changed:
```sql
SELECT id, metric_id, alert_type, created_at, resolved_at
FROM metric_alerts
WHERE metric_id IN ('evaluator.low-quality-rate-24h','evaluator.substantive-low-quality-rate-24h')
ORDER BY created_at DESC
LIMIT 20;
```

3) Confirm `metric.breach` events are emitted only for substantive metric (or that broad breaches are now P3-deferred):
```sql
SELECT id, event_type, timestamp, data
FROM events
WHERE event_type='metric.breach'
ORDER BY timestamp DESC
LIMIT 50;
```

---

## 5) Recommended follow-up (to protect against false-good inflation)

If we exclude/downgrade broad metric in paging, we should still track (and maybe page at lower urgency) the **unscorable pipeline classes** so the system doesn’t go “quiet” while reality is broken.

Suggested companion metrics (already aligned with the project’s direction):
- `evaluator.unscorable-rate-24h` (runner interruptions / transcript schema errors / missing artifacts)
- `evaluator.hygiene-failure-rate-24h` (finish blocked, dirty git state)

These should be tracked separately from substantive output quality.
