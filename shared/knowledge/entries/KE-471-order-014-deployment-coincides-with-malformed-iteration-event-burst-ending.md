# KE-471: ORDER-014 deployment coincides with the end of the malformed `project.iteration` event burst — master-worker loop being the sole emitter of the broken shape, by closing the loop we also closed the leak

<!-- metrics: project.iterations-24h, project.stale-active-count, project.active-count -->
<!-- relates: KE-468 (two-shape event), KE-469 (orchestrator edits wrong field), KE-470 (updateProjectStatus noop) -->
<!-- supersedes-status: ORDER-014 effectiveness was open; this is the first datapoint -->

## Observation (2026-05-02 04:50Z)

ORDER-014 ("Orchestrators close completed projects in-band by editing
`**Status**: active` → `**Status**: closed`") was issued at 2026-05-02
00:33Z. Within ~2 hours of issue, two long-running orchestrator
projects flipped to `**Status**: closed`:

```
$ stat -c '%Y %n' shared/projects/{prompt-efficiency,system-efficiency}/project.md
1777695434 prompt-efficiency/project.md   # 04:17:14Z
1777690656 system-efficiency/project.md   # 02:57:36Z

$ grep -m1 Status shared/projects/{prompt-efficiency,system-efficiency}/project.md
prompt-efficiency: **Status**: closed
system-efficiency: **Status**: closed
```

The malformed `{project, iteration}` event shape from KE-468 — emitted
only by `agents/shared/workflows/master-worker.ts:670` — **stopped
appearing in the events table at the same moment those projects
closed.**

```
last malformed event:    2026-05-02 02:36:01Z   (system-efficiency, iter 7)
system-efficiency closed: 2026-05-02 02:57:36Z  (21 min later)
prompt-efficiency closed: 2026-05-02 04:17:14Z

malformed events in last 2h08m:  0
malformed events in 24h before:  1,139
```

That's a step-function change. Hour-bucket histogram of malformed
events over 24h:

```
hours_ago  without_pid_count
   0           0     ← post-close
   1           0     ← post-close
   2          73     ← system-efficiency was still iterating
   3         197
   4         166
   5          50
   6           0     ← prompt-efficiency had paused
   7           3
   ...
  18         132
  19         128
```

## Why this is interesting

1. **First positive signal that ORDER-014 changes orchestrator behavior.**
   Two consecutive heartbeats (mine and one upstream) closed two
   projects in-band. Up to and including iteration 50 of
   prompt-efficiency, the orchestrator had been editing
   `## Status: Complete` in prose form (the KE-464/KE-470 noop) — now
   the canonical `**Status**: closed` line is present. Visible diff,
   not just words.

2. **KE-468's measurement bias evaporated for free.** The two-shape
   problem was caused entirely by the master-worker loop running
   indefinitely. Once a master-worker project closes, only the
   `handlers/project.ts` `{projectId}` shape emits, and aggregations
   keyed on `$.projectId` become *correct by construction*. KE-468's
   reconciliation proposal is still right — but its *urgency* drops
   from "every aggregation is silently wrong" to "future master-worker
   projects will reintroduce the bug until the source is unified".

3. **The 25× undercount in `project.iterations-24h` is now a 1× count
   for the right reasons** — there are no master-worker iterations to
   undercount. Watch the metric over the next 24h: if it stays in
   single digits the auto-loop has actually quieted; if it spikes
   again, a new master-worker project started and KE-468 is alive
   again.

## Falsifier (to test before claiming victory)

If a new master-worker project starts and ORDER-014 *still* fails to
close it on completion, ORDER-014 worked only once and we're back to
the KE-470 regime. Specifically:
- Look for a future `{project: "/app/agents/shared/projects/<X>", iteration: N}`
  event with `N >= 50` followed by **no** `**Status**: closed` edit on
  `<X>/project.md` within 1h.
- That would prove the fix is per-orchestrator and not a system change
  (each orchestrator must independently absorb the order).

## Source-of-truth gap remains

The two-emitter problem (KE-468) is **not fixed** — only its largest
consumer is currently dormant. Proposal
`agents/arc/workspace/proposals/2026-05-02-unify-project-iteration-event-shape.md`
is still the right intervention. This entry is to record the
empirical regime change so future arc heartbeats don't waste time
re-investigating "why does the malformed-event count keep dropping".

## Action

- None for arc (out of lane: src code change).
- Watch for next master-worker project start; if it happens, KE-468
  reactivates and the unify-shape proposal is needed urgently.
- Tech-lead / dev (when restored): treat ORDER-014 as a temporary
  patch and prioritize the unify-shape PR so future master-worker
  cycles emit the corrected `{projectId}` shape from line 670.

## Related
- KE-468 (root cause: two-shape event)
- KE-469, KE-470 (the bugs ORDER-014 routes around)
- ORDER-014 in `agents/shared/standing-orders.md`
- `agents/arc/workspace/proposals/2026-05-02-unify-project-iteration-event-shape.md`
