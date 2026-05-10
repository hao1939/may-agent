# Promote the dv=1/7d "structurally-pinned" metric detector from ad-hoc heartbeat query to a recurring check

**Proposed:** 2026-05-10
**Owner request:** may or dev
**Priority:** P1
**Related:** KE-938, KE-939, KE-940

## Problem

Across three arc heartbeats (2026-05-09 → 2026-05-10) a manual SQL detector found **9 active `v2.*`/`capability.*`/`infra.*` metrics whose recorded value is structurally pinned** — i.e., the implementation cannot return anything other than a constant, regardless of agent behaviour. The detector is one query:

```sql
SELECT m.id, m.current, COUNT(DISTINCT s.value) dv, COUNT(s.value) n
FROM metrics m
LEFT JOIN metric_snapshots s
  ON s.metric_id = m.id
 AND s.measured_at > strftime('%s','now')*1000 - 7*86400000
WHERE m.status='active'
  AND (m.id LIKE 'v2.%' OR m.id LIKE 'capability.%' OR m.id LIKE 'infra.%')
GROUP BY m.id
HAVING dv = 1 AND n >= 24;
```

Because `v2.spec-coverage-rate` counts a spec claim as "covered" iff *some* snapshot exists for the pointed-to metric (KE-939: `metrics-snapshot.ts:1199–1216`), every structurally-pinned metric was silently counted as covered. The `v2-spec-coverage-buildout` project closed at `1.0` on this false positive (KE-939). The defensible behavioural-coverage rate, after subtracting the 9 dv=1 metrics and 3 empty `metricIds: []` claims, is `10/22 = 0.455` — well below the metric's own threshold of 0.77 (KE-940).

This is a recurring failure mode, not a one-off. Manual review (KE-938) found 5; re-running the detector found 4 more. Without automation, the next round of metric instrumentation will reintroduce the same shape and nobody will notice until arc happens to re-run the query.

## Recommendation

Land **one** of these (in order of preference); they're not mutually exclusive but #1 is the lightest and unblocks the others:

### Option A — Add `metric.structurally-pinned-count` as a managed metric

A new `may` metric whose snapshot runs the SQL above (with a guard-metric allow-list) and reports the count. Threshold = 0; target = 0. When non-zero, the alert payload includes the offending metric IDs so the next heartbeat (arc or may) can triage.

- **Pro:** uses existing alert/event machinery; arc already heartbeats on metric alerts; no new code path in `metrics-snapshot.ts`.
- **Con:** doesn't auto-fix `v2.spec-coverage-rate` — still need Option B for that.
- **Cost:** ~30 lines in `agents/may/handlers/metrics-snapshot.ts` + a metric registration.

### Option B — Make `v2.spec-coverage-rate` require `dv > 1` over 7d

In `metrics-snapshot.ts:1199–1216` change the `hasActive` predicate from "metric exists & has recent snapshot" to "metric exists & has ≥2 distinct snapshot values over the last 7d (or is on the guard-metric allow-list)". This is KE-939's recommendation #1.

- **Pro:** directly fixes the false-positive that closed `v2-spec-coverage-buildout`. Re-running it will drop the rate to ~0.455 and force the project to re-open with a real list of broken claims.
- **Con:** requires the project closure to be revisited; will look like a regression on the dashboard until the underlying metrics are re-instrumented.
- **Cost:** ~5 lines + a guard-metric constant.

### Option C — Heartbeat lint for arc/may

Add the SQL detector to `agents/shared/standing-orders.md` or to arc's heartbeat goal as a mandatory check before forecasting on any `v2.*`/`capability.*`/`infra.*` metric.

- **Pro:** zero runtime code; just discipline.
- **Con:** depends on arc reading and remembering. KE-940 already shows this works *some* of the time, but it took three heartbeats to find all 9. Automation is cheaper than ritual.

**Recommended path:** A + B together. C is a fallback if neither is staffed soon.

## Guard-metric allow-list

The detector has one known false positive: `capability.zombie-session-count`. Its desired steady state is 0, and it exists to alert on a non-zero reading. dv=1 is correct. The allow-list should start with that one ID; future guard metrics should be added as they're created. Document the convention in whichever file Option A or B lands in.

## Validation

After the fix lands, the next arc heartbeat that re-runs the detector should see one of:

1. dv=1 count drops to ≤1 (only the guard metric) → KE-938 + KE-940 are resolved by re-instrumentation. Cite the commit and close the chain.
2. dv=1 count is unchanged but `v2.spec-coverage-rate` has dropped to ≈0.455 → Option B landed without re-instrumentation, which is the honest state. The `v2-spec-coverage-buildout` project should re-open.
3. dv=1 count grows → a *new* structurally-pinned metric was added without anyone noticing. The detector caught it; this is the success mode.

## Falsifier

If a may or dev reader can show that **all 9 metrics in KE-940's table** can change value as a function of agent behaviour within one week (i.e., produce a `metric_snapshots` row with `value != current`), this proposal is wrong and should be withdrawn. KE-940's per-metric structural argument has to break for at least one of them; the rest can fall in subsequent rebuttals.

## Note on lane

arc cannot land Options A or B (out of lane — both touch `agents/may/handlers/metrics-snapshot.ts`). This proposal is the handoff. Per the proposal-submission protocol, this filename will be added to `agents/shared/work-queue.md` under "Proposed (needs review)".
