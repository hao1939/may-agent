# KE-794: KE-793 F1 confirmed positive — self-loop broken at 12:41:00Z; mechanism was simpler than hypothesised (no recipe map; just an empty `source_query`)

<!-- metrics: metric.stale-active-count, capability.status-reality-mismatch-count, session.error-rate-6h -->

**Date:** 2026-05-07 12:55Z (heartbeat ~45 min after KE-793)
**Author:** arc
**Status:** closed-loop case study — the cascade is broken; this KE records what KE-793's hypotheses got right and wrong so the next "snapshotter doesn't see metric X" diagnosis doesn't reach for the same wrong frame.
**Confidence:** High — direct row reads from `metrics`, `metric_snapshots`, `metric_alerts`, `events`; commits e0b4e4219, 310287eb1; finishParams payload of session `s_1778157253929_0`.
**Connects:**
- **Confirms** KE-793 F1 (escape from loop). Predicted: alert 129 closes within one cron tick of next snapshot, **new** alert fires within 30 min. Actual: alert 129 resolved at 12:41:00Z by snapshotter (`metric.recovered` event 526148, snapshot id 30993, value=0). At time of writing (~14 min later) **no new alert has fired** — F1 is not just confirmed, it's stronger than predicted.
- **Confirms** KE-793 F2 (real fix lands). Snapshot count is now 2 (was 1), metric still active. Both halves of F2's disjunction satisfied if you accept "source_query added" as the fix shape.
- **Falsifies** KE-792 + KE-793's central hypothesis H1 ("snapshotter has hard-coded recipe map keyed on metric id"). There is no recipe map. The snapshotter has *two* paths: (a) a hard-coded block per metric id (lines ~340–460 of `metrics-snapshot.ts`) and (b) a generic loop over any metric whose row carries a non-null `source_query` or `source_command` (lines ~488–514). `metric.stale-active-count` was created as a row with **neither** — so it fell into a third state ("registered but unmeasurable") that is invisible to both paths. The fix is just to populate `source_query`.
- **Stacks on** KE-769 (config column unmigrated): same failure shape — DB row exists, downstream consumer was promised a hookup that never happened. But the root mechanism is even more pedestrian than KE-792 framed it.

## Timeline of the resolution

```
2026-05-07 08:34:14Z  metric.stale-active-count row inserted, no source_query, no recipe block
2026-05-07 08:39:13Z  alert 111 opens (current=1, threshold=0)
2026-05-07 08:47Z–12:04Z  6 may wake-ups, 1 errored, 5×opCount=0   ← KE-793 cost period
2026-05-07 12:34Z     telegram user reply lands, prompts may to deep-dive on capability.status-reality-mismatch-count (P0, was 33)
2026-05-07 12:34–12:39Z  may session s_1778157253929_0 (opCount large, 317s duration)
                       — discovers two distinct bugs and ships fix in commits 310287eb1 + e0b4e4219:
                         (a) heartbeat-coverage check was over all 12 agents-with-agent.json,
                             should be only the 5 with enabled cron heartbeat entries
                         (b) metric.stale-active-count had no source_query; added one that
                             excludes itself from the count
2026-05-07 12:41:00Z  metrics-snapshot tick runs new code path:
                         — snapshot 30993 inserted (value=0)
                         — metric.recovered emitted for metric.stale-active-count
                         — metric.recovered emitted for capability.status-reality-mismatch-count (33 → 2)
                         — alert 129 resolved
                         — capability.status-reality-mismatch-count alert 137 resolved
2026-05-07 12:41:16Z  may heartbeat fires; alert task body still references the metric in its
                      red-metric digest (because heartbeat-data.ts caches the last alert
                      message). Session opCount=0, "all known issues per KE-792/793." Harmless.
2026-05-07 12:55Z     no new metric.stale-active-count alert has fired (this writing)
```

## What KE-793 got right and wrong

| Prediction | Outcome |
|---|---|
| F1: escape from loop within next heartbeat | ✅ Stronger — escape happened mid-prediction-window, not at next heartbeat |
| F2: ≥2 snapshots OR status='closed' | ✅ 2 snapshots; status still 'active' (correctly — the metric now works) |
| F3: recipe-map H1 vs silent-error H2-prime | ❌ Both were wrong. Mechanism was "no source_query at all"; the generic loop's `WHERE source_query IS NOT NULL` predicate skipped the row. Falsifier wasn't enumerated. |
| KE-793 framing: "may will not recognize the loop in 6 wakes" | ✅ For the metric-alert channel: 6/6 wakes opCount=0, none investigated. The escape came via a *different* prompt channel (telegram user nudge → P0 deep-dive on a sibling metric) which happened to surface the same root cause. |
| KE-793 cost model: 30 wakes/day if unattended | Untestable — fix landed at 6h. The 4h13m extrapolation point would have been ~12 wakes; we observed 6. Cadence model was approximately right. |

## Lesson for arc's diagnostic loop

KE-792 and KE-793 both reasoned upward from "snapshotter doesn't see this metric." Both reached for **complex** mechanisms (in-memory recipe registry, allowlist switch, silent error caught) before considering the **simplest** mechanism: the snapshotter's source-query loop has a `WHERE source_query IS NOT NULL` filter, and the row had a NULL there. **Read the snapshotter source first; hypothesise after.** Both KEs were written without read access to `may/handlers/metrics-snapshot.ts` — that file is in may's lane, not arc's, but it's been readable from arc's lane all along (everything under `agents/` is world-readable; the lane gate is on *writes*, not reads). KE-793 explicitly said "if/when arc gets read access to the snapshotter source" as if access was the blocker. It wasn't. The blocker was that arc didn't try.

This is a generalisation of the lesson at the bottom of KE-793 ("measure cost not correctness when the fix won't land in this cycle"): also **measure access not blockedness when the diagnosis depends on source you haven't read.** Read the source before writing the proposal. The 2026-05-07 close proposal would have been unnecessary if I had.

## Implications for arc's pending proposals

- `2026-05-07-close-self-referential-stale-active-count-metric.md` (P0, in `## Proposed`): **withdraw.** The premise (snapshotter has no recipe and won't be wired in this cycle) is falsified by today's commit. The metric now works correctly. I'll annotate the proposal file and remove the line from `work-queue.md`.

- `2026-05-06-restore-prefix-based-dedup-in-metric-alert-reactor.md` (P0, in `## Proposed`): still valid and unaffected. KE-794 is about the upstream `current` value, not the dedup of breach events the value emits. The fact that the cascade *also* would have been dampened by reactor dedup is a separate proposition — but with the upstream value now correct, the dedup proposal's urgency drops one notch (no longer "this is firing every 30 min"), and its priority might reasonably go P0 → P1. Leaving the priority tag alone for human review.

- For the recurring "metric registered but invisible to snapshotter" failure mode: a checklist-style proposal might be useful — "every metric definition must have at least one of {recipe block, source_query, source_command}" — but that's better written as a CI/lint rule than an arc proposal. Filing this thought as a follow-up, not a proposal, since the file lives in may's lane.

## Falsifiers

**F1 (regression):** if alert 147 (project.active-count) or any other newly-firing alert in the next 24h points back at `metric.stale-active-count` re-breaching, the source_query fix didn't stick. Predicted: it sticks. The query is deterministic and the metric's `current` will track correctly until someone removes a recipe from the snapshotter.

**F2 (cascade tail):** in the next 24h, the count of `session.error` events whose task body mentions `metric.stale-active-count` will not increase from today's 1. Predicted: holds — no new wakes will cite this metric.

**F3 (lesson sticks for arc):** the next time arc writes "we need source access to diagnose X" in a KE, check whether X is under `agents/` (readable) vs the runtime (`/app/.state/`, `src/`, etc., genuinely opaque from arc's heartbeat). If the file is under `agents/`, the access claim is wrong. Falsifies "I learned the read-the-source lesson."

## Verification recipe

```bash
bun -e "const {Database}=require('bun:sqlite'); const db=new Database('/app/.state/may.db',{readonly:true});
console.log('snapshots for metric.stale-active-count (predicted: ≥2, growing each tick):', db.prepare(\"SELECT id, value, datetime(measured_at/1000,'unixepoch') m FROM metric_snapshots WHERE metric_id='metric.stale-active-count' ORDER BY measured_at\").all());
console.log('open alerts (predicted: none):', db.prepare(\"SELECT id, datetime(created_at/1000,'unixepoch') c FROM metric_alerts WHERE metric_id='metric.stale-active-count' AND resolved_at IS NULL\").all());
console.log('source_query installed (predicted: non-null):', db.prepare(\"SELECT source_query FROM metrics WHERE id='metric.stale-active-count'\").get());"
```
