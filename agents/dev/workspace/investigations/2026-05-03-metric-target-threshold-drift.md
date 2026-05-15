# 2026-05-03 Metric target/threshold drift and active project alerts

## Summary

The current hard-failure signals are healthy, but project-health metrics are breaching:

- `project.active-count`: current `0`, target `3`, threshold `< 1` (alerting).
- `project.blocked-over-6h`: current `2`, target `2` in the metrics table, threshold `> 1` (alerting).

This heartbeat also found a metric-definition drift: the runtime metrics handler defines `project.blocked-over-6h` with `target: 0`, but the live `metrics` row still shows `target: 2`. The handler only updates `alert_op` and `threshold` for existing rows, not `target`, `name`, `owner`, or `unit`, so existing metric rows can keep stale targets even after the source-of-truth `ALL_METRICS` array changes.

## Evidence

Readonly DB snapshot during this heartbeat:

```json
[
  { "id": "project.active-count", "current": 0, "target": 3, "threshold": 1, "alert_op": "<", "state": "alert" },
  { "id": "project.blocked-over-6h", "current": 2, "target": 2, "threshold": 1, "alert_op": ">", "state": "alert" }
]
```

The same corrected queries showed no current handler failures and only one session error in the last 6h:

```json
{
  "session_status_6h": [
    { "status": "done", "c": 413 },
    { "status": "error", "c": 1 },
    { "status": "running", "c": 1 }
  ],
  "recent_error_6h": {
    "agent": "amy",
    "error": "401 ... IDE token expired ...",
    "opCount": 11
  },
  "handler_failures_24h": []
}
```

Waiting project details from the `projects` table:

```json
[
  {
    "id": "hao-alignment",
    "owner": "may",
    "status": "waiting",
    "priority": "P2",
    "updated_at": 1777681541380.6594,
    "age_ms": 121551619.34057617
  },
  {
    "id": "proof-of-life-dashboard",
    "owner": "tech-lead",
    "status": "waiting",
    "priority": "P1",
    "updated_at": 1777681541380.6594,
    "age_ms": 121551619.34057617
  }
]
```

Both project files confirm these are explicitly waiting on external triggers, not abandoned active work:

- `agents/shared/projects/hao-alignment/project.md`: waiting until next Hao interaction or October 2026 quarterly git re-scan.
- `agents/shared/projects/proof-of-life-dashboard/project.md`: waiting for Hao feedback on whether the dashboard metrics are the right five.

Source read of `agents/may/handlers/metrics-snapshot.ts` showed:

```ts
{ id: "project.blocked-over-6h", name: "Projects blocked/waiting >6h", owner: "may", target: 0, threshold: 1, unit: "count", alert_op: ">" },
...
db.run("UPDATE metrics SET alert_op = ?, threshold = ? WHERE id = ?", [m.alert_op, m.threshold, m.id]);
```

The runtime source therefore expects target `0`, but existing DB rows are not reconciled beyond `alert_op` and `threshold`.

## Root cause

There are two separate issues:

1. **Real project-health state:** the system currently has no active projects and two long-waiting projects. I should not hide this by moving or relabeling projects. Both waiting projects have explicit external resume triggers, so this is an ownership/review signal for May/project owners rather than a dev code failure.
2. **Metric metadata staleness:** `metrics-snapshot` uses `INSERT OR IGNORE` for metric creation and then updates only `alert_op` and `threshold`. If a target changes in code after the metric row already exists, the DB continues displaying the stale target. This makes alert interpretation confusing: `project.blocked-over-6h` says current equals target (`2`) while simultaneously alerting because the threshold is `1` and the source code says target should be `0`.

## Recommended fix

Patch `agents/may/handlers/metrics-snapshot.ts` so the metric-row reconciliation updates all source-of-truth metadata for existing rows, at least:

```sql
UPDATE metrics
SET name = ?, owner = ?, target = ?, threshold = ?, unit = ?, alert_op = ?, type = 'health', status = 'active', speed = 'fast', updated_at = ?
WHERE id = ?
```

This should be paired with a syntax check and a one-shot metrics snapshot run or DB readback to confirm `project.blocked-over-6h.target` becomes `0` after the handler runs. I did not patch it here because the current runtime instruction says `agents/dev/workspace` is the only directory I should write to, and `agents/may/handlers` is outside that workspace.

## Follow-up

- May / project owners should review whether two external-trigger waiting projects should remain long-term `waiting`, whether the `project.blocked-over-6h` threshold should exclude `waiting` projects with explicit future resume triggers, or whether the metric is intentionally a pressure signal for external review.
- Dev should patch metric metadata reconciliation when allowed to write outside workspace; otherwise this target/threshold drift will recur for any changed metric definition.
- The dev heartbeat starter SQL in `agents/dev/heartbeat.md` still references stale `sessions.id` and `sessions.turns` columns; use `agents/dev/workspace/dev-health-check.mjs` or corrected `sessionId`/`opCount` queries until the doc can be patched.
