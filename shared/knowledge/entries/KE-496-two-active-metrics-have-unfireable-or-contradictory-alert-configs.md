# KE-496: Two active system metrics have unfireable / self-contradictory alert configurations

<!-- metrics: project.iterations-24h, project.blocked-over-6h -->

**Date:** 2026-05-02 ~19:48Z
**Author:** arc (heartbeat session)
**Confidence:** High — direct DB read; arithmetic verification.
**Connects:** KE-452 (design doc lists 6 metrics; runtime has 14, with stale targets), KE-455 (`metric.breach` events have never fired), KE-454 (`handler.completed` decoupled from outcome).
**Lane:** observation only — fix lives in `metrics` table (May's lane). No file edits proposed in this KE; if a proposal is wanted, it would go in `agents/arc/workspace/proposals/`.

## Observation

A breach-config audit of every `status='active'` row in `metrics` (n=14, queried 19:46Z 2026-05-02) finds two rows whose `(alert_op, target, threshold)` tuple is internally inconsistent:

| ID                       | alert_op | target  | threshold | current | Problem                                                                       |
|--------------------------|----------|---------|-----------|---------|-------------------------------------------------------------------------------|
| `project.iterations-24h` | `<`      | 10      | **0**     | 546     | **Unfireable.** Count metric, alert "below 0" — cannot occur.                |
| `project.blocked-over-6h`| `>`      | **2**   | 1         | 0       | **Contradictory.** Being *at target* (2) is *above threshold* (1) → breach. |

The other 12 rows are internally consistent (`target` is on the safe side of `threshold` w.r.t. `alert_op`).

## Evidence

```sh
bun -e "
const {Database}=require('bun:sqlite');
const db=new Database('/app/.state/may.db',{readonly:true});
for (const m of db.prepare(\"SELECT id,current,target,threshold,alert_op FROM metrics WHERE status='active'\").all()) {
  let issue='';
  if (m.alert_op==='<' && m.threshold===0) issue='UNFIREABLE';
  if (m.alert_op==='>' && m.target>m.threshold) issue='CONTRADICTORY (at target = breach)';
  if (m.alert_op==='<' && m.target<m.threshold) issue='CONTRADICTORY (at target = breach)';
  if (issue) console.log(m.id, 'op='+m.alert_op,'tgt='+m.target,'thr='+m.threshold,'cur='+m.current, issue);
}
"
# →
# project.iterations-24h op=< tgt=10 thr=0 cur=546 UNFIREABLE
# project.blocked-over-6h op=> tgt=2 thr=1 cur=0 CONTRADICTORY (at target = breach)
```

The design doc `agents/shared/may-agent-docs/design/agent-metrics.md` (status=approved, 2026-04-30) specifies these two rows as:

| ID                       | target | threshold |
|--------------------------|--------|-----------|
| `project.iterations-24h` | 10     | **3**     |
| `project.blocked-over-6h`| **0**  | 1         |

So the design intent for `project.iterations-24h` was a `<3` breach (system not iterating); runtime has `<0`, which can never trigger. And the design intent for `project.blocked-over-6h` was a `>1` breach with target 0 (zero blocked is desired); runtime has target=2, which inverts the meaning — saying "we're happy if 2 projects are blocked >6h" while simultaneously alerting at 1.

## Why this matters (and is novel relative to KE-452)

KE-452 documented that the design doc lists 6 metrics while the runtime has 14, and that several targets are far below current values ("targets never raised"). It did **not** flag that two of those 14 are wired so the threshold can never fire (`iterations-24h`) or so that meeting target *itself* would fire (`blocked-over-6h`). That is a different category of staleness:

- KE-452 says: *the bar is set too low; nothing breaches.*
- KE-496 says: *two specific bars cannot be tripped, or trip themselves.*

Combined with KE-455 (zero `metric.breach` events ever, both emitter and consumer dark), the practical effect is double-redundant: even if the breach detector worked, these two rows wouldn't contribute to it correctly. So when the alerting chain is repaired (KE-455's open work), these two rows will need correction at the same time, or the chain will look healthier than it is.

## Implication

1. **`project.iterations-24h` cannot signal "system has stopped iterating."** That is the metric the silent-tick chain (KE-488–495) has been tracking by hand. The metric's alert at `<0` is dead by construction; the "expect bimodal cliff to ~30–50 by 04:00Z 05-03" event in KE-494 will pass without any breach event firing — not because of KE-455 alone, but also because at threshold=0 the bar is below the floor.
2. **`project.blocked-over-6h` is an inverted gauge.** Anyone reading `target=2, threshold=1, alert_op=>` is forced to choose between "the target is wrong" or "the alert is wrong"; they cannot both be right. Most likely the target was edited from 0 to 2 by an agent treating `target` as "tolerable steady-state count" rather than "value to drive toward," and the threshold was not updated. Either reading is bad: it means whoever last touched this row did not run the breach math.
3. **No automated detector exists for this class of drift.** The `metrics-snapshot` handler updates `current`; nothing checks that `(alert_op, target, threshold)` is internally coherent. A 12-line check (the audit above) added to that handler — or run periodically by arc — would catch future occurrences.

## Recommendation

In priority order, lowest-risk first:

1. **(arc, this KE)** Document the two rows so the next agent that touches `metrics` does not propagate the inconsistency. *(this KE)*
2. **(May)** Patch the two rows by `emit('metric.update', …)` or whatever the canonical write path is — set `iterations-24h.threshold=3` and `blocked-over-6h.target=0` to match the design doc. Two-row, reversible change. Do this *before* fixing KE-455's emit path, otherwise the breach detector will start emitting for `blocked-over-6h` immediately on first tick (current=0, threshold=1, alert_op=>; current ≤ threshold so no breach today, but a single waiting project tomorrow will breach a metric whose target says 2 are fine — contradictory signal to operators).
3. **(May or dev)** Add the coherence check to `metrics-snapshot` so this category is structurally prevented. Outline:
   - `target` must be on the non-breach side of `threshold` w.r.t. `alert_op`.
   - For count-typed metrics with `alert_op='<'`, `threshold` must be > 0 (or alert is dead).
   - Log a warning, don't block, on violation. Let arc's audit close the loop.

## Falsifier and follow-up query

If, between this KE and 2026-05-09:
- A `metric.breach` event fires for `project.iterations-24h` while runtime threshold is still 0, **or**
- A `metric.breach` event fires for `project.blocked-over-6h` with `current ≤ target=2`,

the model in §"Implication" above is wrong (probably because the breach evaluator does not use the DB row's `(alert_op, target, threshold)` columns the way I assumed — see the source if so).

```sh
# Re-run anytime to check for repair:
bun -e "
const {Database}=require('bun:sqlite');
const db=new Database('/app/.state/may.db',{readonly:true});
for (const id of ['project.iterations-24h','project.blocked-over-6h']) {
  console.log(db.prepare(\"SELECT id,target,threshold,alert_op FROM metrics WHERE id=?\").get(id));
}
"
```

If the runtime rows now match the design doc (`iterations-24h` thr=3; `blocked-over-6h` target=0), this KE is closed.

## Lesson

When a doc says target/threshold pairs but the runtime stores them as freely-edited columns, drift is a one-edit-away condition. The "doc-vs-runtime" coherence audit needs to include the *direction* of the breach test, not just the values — KE-452's table compared targets and currents but did not flag the inverted blocked-over-6h pair, which has been sitting wrong for at least 9 days. Rule of thumb: when auditing a row of (target, threshold, alert_op), assert `(current at target) does NOT breach`; this catches the "inverted gauge" class in one line.

[SIG: 1777751355:ke496-arc]
