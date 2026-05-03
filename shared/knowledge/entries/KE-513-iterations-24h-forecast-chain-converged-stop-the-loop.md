# KE-513: KE-502 → KE-512 forecast chain has converged; further refinement is busywork. Stop the loop and route attention to the unadopted reconcile proposal.

<!-- metrics: project.iterations-24h, project.blocked-over-6h -->

**Date:** 2026-05-03 ~04:50Z
**Author:** arc (heartbeat session, ~35 min after KE-512)
**Confidence:** High on the meta-claim; trivially verifiable on the data point.
**Connects / closes:** KE-502, KE-503, KE-504, KE-505, KE-506, KE-507, KE-508, KE-509, KE-510, KE-511, KE-512 (eleven consecutive arc-authored KEs about `project.iterations-24h` decay between 22:42Z 5/2 and 04:50Z 5/3).
**Re-elevates:** KE-496 (two metrics with unfireable / contradictory alert config), `agents/arc/workspace/proposals/2026-05-01-agent-metrics-doc-reconcile-and-raise-targets.md` (open since 2026-05-01, 2 days unadopted).

## Why this KE exists

In the last 6h I ran 5 arc heartbeat sessions (65 ops total) and produced KEs 508–512, all forecasting/refining the decay of `project.iterations-24h` after the 22:42Z 5/2 burst. KE-512 collapsed the entire forecasting question into a deterministic per-event ledger: query the in-window `project.iteration` events, bucket by `timestamp + 24h`, and you get the exact value at every snapshot until the next emission.

There is **no remaining forecasting question** for this metric. KE-512's first checkpoint just passed:

| time | KE-512 said | observed |
|---|---|---|
| 04:17Z 5/3 | 35 | **35** ✓ |
| 04:47Z 5/3 | 34 | **34** ✓ (snapshot 04:47:09Z) |
| 05:47Z 5/3 | 30 | pending |
| 14:42Z 5/3 | 1 | pending |
| 02:42Z 5/4 | 0 | pending |

The remaining checkpoints will pass for the same structural reason (events age out individually; no new emissions are expected because `project.active-count = 0`). Writing KE-513 to confirm them, then KE-514 to confirm the next, is **a forecasting loop, not investigation.** It is the pattern KE-512's own self-check warned about: "anchor on salient event, skip the deterministic query." The deterministic query has already been run; producing more KEs against it is exactly the busywork ORDER-002 prohibits.

## What we actually learned across the chain

Three durable findings, worth keeping; everything else is forecast-error correction noise:

1. **(KE-503, restated)** `project.iterations-24h` cannot signal "system stopped iterating" while `project.active-count = 0` and the metric's threshold is `<0` (KE-496). The cliff and decay are *expected behavior* of an unfireable metric, not bugs. There is no observation any future heartbeat could make on this metric, in this configuration, that would constitute new information.
2. **(KE-508/KE-512)** Event-driven decay is per-event-individual, not bucketed. For any 24h-window count metric, the decay schedule is fully determined by the in-window event timestamps. **Standing rule:** do not range-forecast such metrics; query and bucket.
3. **(KE-510, side-finding)** Singleton iteration emissions can land into closed projects (`coach/skill-workflow-audit` Status=closed, emitted at 02:42:22Z 5/3). The emission path is the same one covered by `agents/arc/workspace/proposals/2026-05-02-unify-project-iteration-event-shape.md`. No new KE needed; the existing proposal stands.

## Where the actual leverage is

While I was writing 11 KEs, the proposal that would *fix* the unfireable-metric class — `agents/arc/workspace/proposals/2026-05-01-agent-metrics-doc-reconcile-and-raise-targets.md` — has been sitting unadopted for two days. It is owned by may / Hao. It would:

- Set `project.iterations-24h.threshold` from 0 → 3 (per the design doc).
- Set `project.blocked-over-6h.target` from 2 → 0 (per the design doc).
- Reconcile the 8 active metrics that aren't in `agent-metrics.md`.

If that proposal is adopted, KE-496's "unfireable / contradictory" findings close, and the silent-tick chain (KE-488–495) gains a real breach signal instead of a manual one. None of KE-502 through KE-512 contributed to making that adoption more likely; on the priors, they may have *reduced* its salience by burying it under decay-schedule noise.

## Standing rule for future arc heartbeats (this KE's only prescription)

**When a forecasting chain reaches a deterministic ledger, stop.** Specifically:

1. If a metric's value is fully determined by queryable rows (e.g., per-event aging, per-row state) and you have written the query, you are done forecasting it. Future "the schedule held" / "the schedule shifted by 1" KEs are zero-leverage.
2. The next heartbeat's job for that metric is *only* to detect **new emissions** (re-opens the model) or **handler-edge bugs** (the "metric uses `>` not `>=`" branch in KE-512's falsifier). A 1-line check is sufficient; no KE if it passes.
3. Re-route the saved capacity to whichever open arc proposal has the highest unadopted age. Today that's the reconcile-and-raise-targets proposal (2 days old); tomorrow it may be a different one.

This rule is testable: if KEs 514, 515, 516 are about `project.iterations-24h` decay schedule passing, this KE failed and should be rewritten. If they're about something else (or the reconcile proposal status changed), it worked.

## One-line check for the next arc heartbeat

```sh
bun -e "
const {Database}=require('bun:sqlite');
const db=new Database('/app/.state/may.db',{readonly:true});
const since = 1777776142353; // ms after the 02:42:22.352Z singleton
const n = db.prepare(\"SELECT COUNT(*) c FROM events WHERE event_type='project.iteration' AND timestamp > ?\").get(since).c;
console.log('new project.iteration emissions since KE-512 anchor:', n);
"
```

- If `n = 0`: the schedule holds, no KE needed, do something else.
- If `n ≥ 1`: a new emission landed — *then* (and only then) write a KE updating the ledger.

## Falsifier for KE-513

This KE claims the chain is converged and further per-snapshot KEs are busywork. It is **falsified** if any of the following happens within 7 days:

1. A `project.iteration` emission lands while `project.active-count = 0` AND it is not from a closed-project namespace bug already covered by `2026-05-02-unify-project-iteration-event-shape.md` — i.e., a *new* emission path appears that the deterministic ledger can't model. (Then per-event modeling needs to be re-derived; the chain is *not* converged.)
2. KE-512's schedule is wrong by ≥3 at any future checkpoint — meaning the metric handler edge logic differs from `timestamp + 86_400_000` (e.g., uses snapshot-time vs handler-fire-time). Then a new KE explaining the edge logic is warranted; this KE was premature.
3. Hao/may rejects the reconcile-and-raise-targets proposal with reasoning that depends on data the chain produced (e.g., "we want to see decay shapes before deciding"). Then the chain *was* leverage and I misread its purpose.

If none of those happen, KE-513 stands and the loop is closed.

## Self-check

- Lane: `agents/shared/knowledge/entries/` ✓
- No code changes, no out-of-lane edits.
- Schema reality: `events.timestamp` (ms), `metrics.threshold` (numeric), `project.active-count.current = 0` verified at 04:48Z. ✓
- Meta-claim is testable in one query at every future arc heartbeat.
- This KE is *short on purpose*: a meta-stop that itself runs long would prove its own point wrong.
