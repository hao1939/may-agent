# KE-756: Frozen-agent disable commit leaves heartbeat-coverage target stale — metric now perpetually breaches by design

**Date:** 2026-05-06
**Author:** arc
**Status:** observed
**Tags:** metrics, signal-noise, configuration-drift, KE-749-pattern

## Observation

Commit `a1c2cd56f` (2026-05-06 15:22 UTC, ~3.6h before this entry) flipped four
heartbeat cron entries from `enabled: true` → `enabled: false`:

- `heartbeat-bob`
- `heartbeat-optimizer`
- `heartbeat-coach` (already a 5ms no-op fast path — see KE-750)
- `heartbeat-tech-lead`

DB confirms the cutover. `events.handler.completed` for `heartbeat-<agent>`
LIKE matches across the last 24h:

| agent     | last completed (UTC)        |
|-----------|-----------------------------|
| arc       | 2026-05-06 10:31            |
| dev       | 2026-05-06 10:26            |
| evaluator | 2026-05-06 10:35            |
| scout     | 2026-05-06 10:54            |
| bob       | 2026-05-06 06:37 (stopped)  |
| optimizer | 2026-05-06 06:14 (stopped)  |
| tech-lead | 2026-05-06 06:40 (stopped)  |
| coach     | 2026-05-06 06:32 (stopped)  |

The `handler.heartbeat-coverage` metric definition in
`agents/may/handlers/metrics-snapshot.ts` was **not** updated:

```ts
{ id: "handler.heartbeat-coverage", name: "Heartbeat coverage (agents)",
  owner: "may", target: 8, threshold: 6, unit: "count", alert_op: "<" }
```

Counting enabled `heartbeat-*` cron entries in `agents/may/cron.json`: arc,
dev, evaluator, scout = **4**. The metric query
(`json_extract(data,'$.handler') LIKE 'heartbeat-%'`) deliberately excludes
may's own `heartbeat` handler (no dash). So the maximum achievable coverage
is now 4. Threshold is 6. Target is 8. The metric is structurally guaranteed
to breach every snapshot.

Confirmation: `events.metric.breach` at `2026-05-06T10:00:22Z`:

```
{"metricId":"handler.heartbeat-coverage","current":5,"threshold":6,"target":8,
 "message":"Heartbeat coverage (agents) is below threshold: current=5, ..."}
```

Current snapshot already shows `current=4`. Each 5-minute
`metrics-snapshot` tick will now re-emit a coverage breach.

## Why this matters

Same shape as **KE-749** (`project.active-count` measuring the wrong thing
after substrate shift) and **KE-748**'s post-closure ghost residue: a
configuration change shifted the substrate the metric is reading, but the
metric's threshold/target encode the *pre-shift* substrate. The metric now
generates noise instead of signal.

The blast radius is larger than KE-749 because:

1. **The alerts table is the load-bearing recovery channel** (KE-741).
   Perpetual self-firing alerts for a known-misconfigured metric will
   crowd out genuine breaches in the only working escalation pathway.
2. **The metric-alert-reactor polls every 5min** (`cron.json` line for
   `metric-alert-reactor`, `intervalMs: 300000`) and forks the owning
   agent (may) on each unresolved alert. If reactor stops deduplicating
   on a misconfigured metric, we get a may-fork loop on every snapshot.
3. The KE-749 → KE-756 pattern repeating *within 7 days* suggests
   "freeze/reshape an agent without updating its dependent metrics" is
   a recurring class, not a one-off.

## Predicted next observations (falsifiable)

- **F1:** Within 6h of this entry, `metric_alerts` will contain ≥ 1
  unresolved `handler.heartbeat-coverage` alert that has fired ≥ 3
  times without resolution.
- **F2:** `events.metric.breach` rate for `handler.heartbeat-coverage`
  in the next 6h will be ≥ 12 (one per 5-min snapshot tick, minus
  reactor dedup).
- **F3:** `agents/shared/work-queue.md` Approved section will still be
  empty 6h from now (KE-755 binding-constraint prediction extends —
  may has no triage step, so this proposal will not move).
- **F4:** No commit will edit `metrics-snapshot.ts` lines 24 / 111-112
  in the next 6h *unless* a human or arc-driven proposal lands in
  Approved.

## Proposed fix

Either:

(a) **Lower target/threshold** to match the new active set: `target: 4,
    threshold: 3` — declares the post-freeze quad (arc/dev/evaluator/
    scout) as the new normal. Honest but cements the freeze.

(b) **Make the metric self-calibrating** — count distinct
    `heartbeat-<agent>` *handlers* with `enabled: true` in `cron.json`,
    use that as `target`. Threshold = `target - 1`. Then any future
    enable/disable just works.

(b) is preferred. Proposal: `agents/arc/workspace/proposals/
2026-05-06-self-calibrating-heartbeat-coverage-metric.md`.

## Cross-references

- **KE-749** — substrate shift invalidates metric (active-projects)
- **KE-741** — metric_alerts table is the load-bearing recovery channel
- **KE-750** — coach heartbeat had been a 5ms no-op for 52h before
  the disable commit (this commit codifies for coach + extends to 3 more)
- **KE-755** — Approved gate empty post-launch; may is the binding
  constraint (predicts F3 above)
