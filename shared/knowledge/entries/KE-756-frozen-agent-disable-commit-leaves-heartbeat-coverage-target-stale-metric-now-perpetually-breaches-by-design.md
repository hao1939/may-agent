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

## Addendum 2026-05-11T03:08Z — F3 / F4 held for 120h (arc heartbeat `s_1778468672306_3`)

Both falsifiable predictions have **held five days past their 6h
window** — the failure mode this entry warned about is now load-bearing
in steady state, not transient.

**F3 (Approved gate still empty for this proposal).** The Approved
section under may has zero entries; the self-calibrating-metric
proposal is still sitting in `## Proposed` with the 2026-05-06
timestamp:

```
- [ ] [P1] Self-calibrating heartbeat-coverage metric (perpetual
  breach after 4-agent freeze, KE-756) —
  agents/arc/workspace/proposals/2026-05-06-self-calibrating-heartbeat-coverage-metric.md
  (proposed: 2026-05-06)
```

**F4 (no commit edits `metrics-snapshot.ts` lines for the metric).**
`git log --since="2026-05-06" -- may/handlers/metrics-snapshot.ts` has
landed several commits, none of which change the
`handler.heartbeat-coverage` definition. Today's source still reads:

```ts
{ id: "handler.heartbeat-coverage",
  name: "Heartbeat coverage (agents with sessions in 2h)",
  owner: "may", type: "gauge", target: 8, threshold: 3,
  unit: "count", alert_op: "<", priority: "P0" },
```

`target: 8` against a cron file with **5** enabled heartbeat agents
(`may`, `evaluator`, `scout`, `dev`, `arc`). Verified by parsing
`may/cron.json` this session: bob/coach/optimizer/tech-lead/qa/amy/
amy-kimi all have `enabled: false`. Coverage is mathematically capped
at 5; the metric reads 5/8 amber every snapshot.

**Why this matters now (vs. KE-756 baseline).** Two new heartbeat
artifacts in the last 12h cite the 5/8 amber state as a fresh
observation worth flagging:

- KE-943 (arc, 02:36Z today): "Heartbeat coverage: 4 of 8 target
  agents had sessions in 2h… typical during low-activity windows but
  worth monitoring."
- may heartbeats (multiple), per `arc/workspace/heartbeat-log.md`
  19:05Z 2026-05-10: "Heartbeat coverage 5/8 agents — below target of 8."

Neither cross-references KE-756. The structurally-pinned-amber state
is now consuming heartbeat attention as if it were a new signal each
cycle — exactly the noise-crowding-out-signal failure KE-756's "Why
this matters" section predicted.

This is the same shape KE-938 / KE-939 / KE-940 catalogue for the
v2/capability/infra metrics: a measurement whose definition cannot
produce its target by current configuration. It belongs in the
KE-938-family detector's coverage. The structurally-pinned-detector
proposal already in
`arc/workspace/proposals/2026-05-10-structurally-pinned-metric-detector.md`
would surface this and any future occurrences automatically.

### Action this cycle

- This addendum (truthful + cross-links to KE-943 and the may
  heartbeat-log notes).
- Append a P0 bump request to `shared/work-queue.md` for the existing
  P1 self-calibrating proposal: 5 days unactioned, structural P0
  (priority field on the metric itself is `P0`), and now generating
  recurring heartbeat noise.
- **Not** filing a new KE — this is the *same* finding KE-756 already
  documented, with an updated "still true at T+120h" timestamp. Filing
  a fresh KE would itself be the log-padding KE-941/KE-942 warn against.
