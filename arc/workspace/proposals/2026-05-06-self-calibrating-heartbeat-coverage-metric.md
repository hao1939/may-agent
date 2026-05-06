# Self-calibrating heartbeat-coverage metric

**Proposed:** 2026-05-06
**Author:** arc
**Priority:** P1
**Source KE:** KE-756

## Problem

`handler.heartbeat-coverage` metric has `target: 8, threshold: 6` hardcoded
in `agents/may/handlers/metrics-snapshot.ts` (lines 24, 111-112). Today's
commit `a1c2cd56f` disabled 4 of 8 heartbeat cron entries (bob, optimizer,
coach, tech-lead). Maximum achievable coverage is now 4 — the metric is
guaranteed to breach every 5-min `metrics-snapshot` tick.

This pollutes the `metric_alerts` table, which is the load-bearing recovery
channel (KE-741), and risks driving a may-fork loop via the
metric-alert-reactor (which polls every 5min and forks the owning agent on
unresolved alerts).

This is the same shape as KE-749: substrate shifted, metric encodes the
pre-shift world, signal becomes noise.

## Proposed change

Make the metric self-calibrating against `agents/may/cron.json`. At each
snapshot, compute `expected = (count of enabled cron entries whose name
matches /^heartbeat-/)`, then:

- `target = expected`
- `threshold = max(1, expected - 1)`
- `current = (distinct agents emitting handler.completed for
  heartbeat-<agent> handlers in last 2h)`

When an agent's heartbeat is enabled or disabled in cron.json, the metric
auto-updates the next tick. No manual sync required.

## Implementation sketch

In `metrics-snapshot.ts`, replace the hardcoded line 24 entry with:

```ts
// Compute expected coverage from cron.json (self-calibrating)
let expectedCoverage = 4; // safe fallback
try {
  const cron = JSON.parse(
    require("fs").readFileSync("/app/agents/may/cron.json", "utf8")
  );
  expectedCoverage = cron.filter((j: any) =>
    j.enabled === true && /^heartbeat-/.test(j.name || "")
  ).length;
} catch (e) { ctx.log(`[metrics-snapshot] cron.json read failed: ${e}`); }

metrics.push({
  id: "handler.heartbeat-coverage",
  name: "Heartbeat coverage (agents)",
  owner: "may",
  target: expectedCoverage,
  threshold: Math.max(1, expectedCoverage - 1),
  unit: "count",
  alert_op: "<"
});
```

The measurement query at line 111-112 stays as-is.

## Acceptance criteria

1. `bun test agents/may/handlers/metrics-snapshot.test.ts` passes (add a
   test that toggles `enabled` flags in a fixture cron and asserts target
   tracks).
2. Within one snapshot tick of merge, `SELECT target, threshold, current
   FROM metrics WHERE id='handler.heartbeat-coverage'` returns target=4,
   threshold=3, current=4 (with current quad).
3. No new `metric.breach` events for `handler.heartbeat-coverage` in the
   first 6h post-merge (assuming no agent goes silent).
4. Re-enabling any of bob/optimizer/coach/tech-lead in cron.json bumps
   target up the next tick — metric does not lag.

## Risk / rollback

- Risk: `cron.json` read at every 5-min snapshot. File is ~10KB; cost is
  negligible. Could be cached on first read with mtime check if profiling
  shows otherwise.
- Rollback: revert to hardcoded `target: 8, threshold: 6` (or `target: 4,
  threshold: 3` if the freeze persists).

## Out of scope

- The deeper question of *why* 4 agents were frozen and whether they should
  be re-enabled — that's a may/human policy decision. This proposal just
  makes the metric stop lying about it.
- Generalizing the self-calibration to other config-driven metrics
  (e.g. `project.active-count` per KE-749). Worth doing, but as a separate
  proposal once this pattern is validated on one metric.

## Addendum (2026-05-06, post-KE-760)

This proposal corrects the **target/threshold** side of the metric. KE-760
discovered an independent bug on the **measurement input** side: the
coverage SELECT counts dispatch-dedup phantom completions (2-12ms, no agent
session created), so even with `target=4` correctly calibrated, `current`
holds at 4 throughout windows where an agent is auto-blocked or
permanently dead (coach has been 100% phantom for 48h+).

Companion proposal: `2026-05-06-filter-phantom-completions-from-heartbeat-coverage.md` (P0).

**Both proposals are needed; either alone is insufficient:**
- Self-calibration alone: target tracks reality, but `current=4` from
  phantoms means the threshold never trips even when an agent is gone.
- Duration filter alone: `current` becomes truthful, but `target=8` in a
  4-agent topology guarantees perpetual breach until the topology shifts
  back to 8.

Recommend dev pick the pair up together. Order does not matter.
