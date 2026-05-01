# KE-452: agent-metrics.md design doc lists 6 system metrics, DB has 14 — and targets are never raised after being met
<!-- metrics: system.real-output-24h, project.iterations-24h, handler.success-rate -->

**Date:** 2026-05-01 18:18Z
**Author:** arc (heartbeat session, system coherence audit)
**Confidence:** High — direct evidence from DB and design doc.
**Connects:** KE-433 (arc heartbeat dominance); ORDER-001/002 ("Never coast"); the doc's own "Metric Lifecycle" section.

## TL;DR

Two coupled drifts in `agents/shared/may-agent-docs/design/agent-metrics.md`:

1. **Catalogue drift.** The doc declares **6 system metrics** ("3 infrastructure + 3 output. All measurable today."). The active `metrics` table has **14** (`handler.*`, `system.*`, `project.*`, `session.*`). The doc's git history shows it has bounced between 6 and 8 metric counts (`fc892ddc3`: "8 system metrics", current: 6) without ever matching reality.
2. **Lifecycle drift.** The doc itself prescribes: *"A metric at target is a signal the bar is too low. Never coast. … 4. Raise target — target met consistently? Raise the bar or add dimensions."* The DB shows step 4 has not been executed for any of the system metrics:

| metric | target | current | overshoot |
|---|---|---|---|
| `system.real-output-24h` | 100 | 1781 | 17.8× |
| `project.iterations-24h` | 10 | 673 | 67.3× |
| `handler.completed-count` | 50 | 225 | 4.5× |
| `handler.fires-per-hour` | 30 | 38 | 1.27× |
| `handler.success-rate` | 0.95 | 1.0 | green ceiling |
| `session.error-rate-6h` | 0.10 | 0.0199 | green floor |
| `project.blocked-over-6h` | 2 | 0 | green floor |

The targets are doing nothing useful. They were set when the system was struggling to produce; the system now overshoots by 1–2 orders of magnitude and the targets just sit there as decoration. This violates the doc's own rule.

## Evidence

- `wc -l agents/shared/may-agent-docs/design/agent-metrics.md` → 86 lines; the table at lines ~10–28 enumerates exactly 6 metrics under "System Metrics".
- `bun -e ... SELECT id, current, target, threshold FROM metrics WHERE status='active' AND (id LIKE 'handler.%' OR id LIKE 'system.%' OR id LIKE 'project.%' OR id LIKE 'session.%')` returns 14 rows. The 8 not in the doc: `handler.completed-count`, `handler.failed-count`, `handler.fires-per-hour`, `handler.p95-duration`, `project.active-count`, `project.blocked-count`, `project.blocked-rate-7d`, `project.stale-active-count`.
- `git log -- shared/may-agent-docs/design/agent-metrics.md` shows `fc892ddc3 may: rewrite agent-metrics — 8 system metrics only, drop per-agent metrics`; the doc later regressed to 6 without removing 2 metrics from the DB. So the canonical count has been wrong since at least that commit.
- The "Metric Lifecycle" section ends `5. Graduate — move to watch-only (requires human approval)`. None of the seven overshooting metrics has been graduated.

## Implication

1. **The doc cannot be used to answer "is the system healthy?"** Because there are 8 active metrics not in the table, an operator following the doc only checks 43% of the breach surface. Whoever owns `handler.p95-duration` (currently 139518ms, target 120000ms — *red*) will find out from the alert reactor, not from the design doc.
2. **The "never coast" principle is paper-only.** The doc says raise targets when met; the targets haven't moved while the system has 17×–67× headroom. New agents reading the doc see a contradiction between text and DB. Likely they've concluded silently that targets are aspirational decoration. That's a coherence rot: the design doc is louder than the live targets, so the *behavior* of the system says "targets don't matter" while the *doc* says "targets matter a lot." This is exactly the kind of contradiction arc exists to flag.
3. **The "balanced pairs" rule may be unenforceable today.** The doc claims project metrics should be activity+impact pairs, but the active project metric set (`active-count`, `blocked-count`, `blocked-rate-7d`, `blocked-over-6h`, `iterations-24h`, `stale-active-count`) is *all activity, no impact*. There is no system-level project-impact metric. So the principle as written cannot be applied to system-level project health.

## Recommendation

Two parts, deliberately split between arc's lane and may's lane:

**Arc lane (this session, durable):**
- Write the proposal `agents/arc/workspace/proposals/2026-05-01-agent-metrics-doc-reconcile-and-raise-targets.md` enumerating the 8 missing metrics, proposed new targets for the 7 overshooting ones, and a "graduate vs raise" decision for each. Hao/may decide adoption.

**May lane (proposed, not in this session):**
- Reconcile the table in `agent-metrics.md` to match the live `metrics` table — either remove the 8 extras from the DB or add them to the doc.
- Run lifecycle step 4 (raise target) or step 5 (graduate to watch-only) on the 7 overshooting metrics.

Per arc's escalate-don't-edit policy (KE-451), arc does not edit `agent-metrics.md` directly even though it's nominally an in-lane file (design docs *are* in arc's allowed lanes), because the metric *set* and *targets* are owned by may and changing them is a system-level decision, not a coherence cleanup. The doc text describing 6 metrics is *consistent with itself*; the staleness is between doc and DB, and the DB is the source of truth.

## Falsifier

If by 2026-05-15 the design doc still lists 6 system metrics while the DB has ≥10 system-scope metrics with `status='active'`, the proposal had no effect and arc should escalate to coach for a process review (the "raise targets" loop has never closed in this codebase's history per git log).

If by 2026-05-15 either (a) the doc lists every active system-scope metric, or (b) the DB has been pruned to exactly the doc's set, this entry's recommendation has been actioned and KE-452 closes.

## Connects

- **KE-433** (arc heartbeat dominance): same family — agents follow the loud signal, not the quiet truth. KE-452 is the analogous case for design docs.
- **KE-434** (query_db doc drift): same pattern — docs claim X, runtime has Y. KE-452 extends the pattern from tools to metrics.
- **ORDER-001 / ORDER-002**: "use idle time to push forward", "actions over words". A target met 67× over with no action *is* an idle metric. Raising it is the action.

## Evidence pointers

- `/app/agents/shared/may-agent-docs/design/agent-metrics.md` (lines ~10–28: the 6-row "System Metrics" table)
- `metrics` table query shown above (14 active rows under the 4 doc-defined prefixes)
- `git -C /app/agents log -- shared/may-agent-docs/design/agent-metrics.md` (shows oscillation 6 ↔ 8 metrics across revisions)
