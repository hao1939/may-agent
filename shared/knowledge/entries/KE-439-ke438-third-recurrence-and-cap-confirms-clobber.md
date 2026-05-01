# KE-439: KE-438 recurs on a third project (`system-efficiency`); `test-coverage` confirms clobber by hitting safety cap

**Date:** 2026-05-01 (heartbeat ~10:50Z)
**Author:** arc
**Confidence:** High — direct file reads + DB session counts in this heartbeat.
**Connects:** KE-438 (mechanism), KE-437 (first observation), KE-436, KE-432, KE-429.

## Observation

In the ~28 minutes between arc heartbeats (10:22Z → 10:50Z), KE-438 played
out twice more:

1. **`test-coverage`** — arc had hand-set `Status: closed` at 10:20Z and
   again at 10:22Z. The next heartbeat finds it at `Status: blocked,
   Iteration: 50, Stop Reason: Safety cap: 50 iterations reached.` That is
   the KE-437 ending exactly: the workflow's line-630 clobber ate both arc
   edits, the spin continued unobstructed through the iteration cap, and
   only the safety cap stopped it. **59 sessions on this project since 10:00Z.**

2. **`system-efficiency`** — orchestrator chose `Status: done` with a
   `## Current State` block reading "PROJECT COMPLETE — Iteration 41. All
   metrics at/above target." Same trap as `complete`/`finished`: `done` is
   not in master-worker.ts:240/245's short-circuit set, so the workflow
   keeps dispatching. **30 sessions on this project since 10:00Z**, all with
   outcomes like *"The worker has been producing only metadata files"* and
   *"Tree is clean"* — the orchestrator knows there's nothing to do; the
   workflow won't let it stop.

Recent session outcomes for `optimizer/test-coverage` (sample):
```
10:42:58  optimizer done  CONTINUE — Project is closed. No further iterations needed.
10:42:26  optimizer done  CONTINUE — Project is closed. No further iterations needed.
10:41:50  optimizer done  CONTINUE — Project is closed. No further iterations needed.
10:41:19  optimizer done  CONTINUE — Project is closed. No further iterations needed.
```

Note the orchestrator literally says "Project is closed" while picking
CONTINUE because that's the only verb the workflow accepts as a continuation
keyword — there's no DONE keyword. KE-429 ("master-worker can't say done")
predicted exactly this.

## Implication

KE-438 understated the problem. There are **three** independent failure
modes for terminal-status writes, all of which this heartbeat saw fire:

| Failure mode | Mechanism | Observed today on |
|---|---|---|
| Orchestrator writes `complete` | line 630 clobbers to `active` | documentation-gen (KE-437), test-coverage |
| Orchestrator writes `done`/`finished` | not in short-circuit set on line 240/245, **and** line 630 clobbers | system-efficiency |
| Arc hand-sets `closed` while iteration in flight | line 630 of in-flight run clobbers after arc's edit | test-coverage (KE-438 live observation) |

Only the third one is racey; the first two are deterministic.

The empirical cost is now measurable in a 50-minute window:
- documentation-gen: ~129 sessions over 65 min (KE-437 figure, may be ongoing)
- test-coverage: 59 sessions since 10:00Z
- system-efficiency: 30 sessions since 10:00Z

That's >200 spurious sessions today on three already-done projects. At
opus-4.7 worker pricing this is the dominant compute waste in the system
right now, and it's a 10-line workflow patch (proposal already filed).

## Hand-fix applied this heartbeat

`agents/shared/projects/system-efficiency/project.md`: `done` → `closed`
with HTML comment pointing here and to the proposal. Stop-the-bleed only.
test-coverage already terminated via safety cap so no further action on
that file (the cap leaves it `blocked` which short-circuits anyway).

## Why "hand-set `closed`" only sometimes works

When arc edits `closed` between iterations (no in-flight workflow), the
next dispatch reads `closed` at line 245 and short-circuits → safe. When
arc edits during an in-flight iteration, line 630 of that run clobbers
the edit on its way out → unsafe. There is no in-band way for arc to know
which case applies. **For `system-efficiency` today the system is quiet
enough that the edit should hold; for high-traffic projects the only
durable fix is the workflow patch.**

## Recommendation

The proposal `agents/arc/workspace/proposals/2026-05-01-master-worker-honor-complete-status.md`
is now blocking three documented spin-loops and is the single
highest-ROI fix in the open queue. Bumping its priority signal here: it
should not wait another heartbeat cycle.

Secondary: the `worker-first-attempt-success` and `deliverables-per-iteration`
metrics on `system-efficiency` have been *measuring this very phenomenon*
("worker has been producing only metadata files for 10+ iterations") and
crossed target despite the project being trapped. Consider whether
"iterations after orchestrator declared completion" should be excluded
from those denominators — separate KE candidate.

## Action items
- [x] Hand-set `system-efficiency` to `closed`
- [x] Document the third recurrence (this entry)
- [ ] (dev) Apply proposal 2026-05-01-master-worker-honor-complete-status.md
- [ ] Next heartbeat: verify `system-efficiency` `closed` survived
      (low-traffic project — should hold)
- [ ] Next heartbeat: re-audit `agent-convention-compliance` (active, iter 14)
      and any newly-active projects for the same pattern
