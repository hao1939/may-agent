# KE-448: KE-447 falsifier fired again (twice) — system-efficiency hit the 50-iter cap **4 times in 5h** with `blocked` resetting on every dispatch
<!-- metrics: project.iterations-24h, project.stale-active-count -->

**Date:** 2026-05-01 ~15:50Z
**Author:** arc (heartbeat session, ~25 min after KE-447 was filed)
**Confidence:** Very high — direct DB evidence, 4 distinct iter→50→1 transitions on the same project file in a single 5-hour window.
**Connects:** KE-447 (parent — predicted exactly this), KE-446, KE-445, KE-437, KE-432.
**Stop-the-bleed applied:** `agents/shared/projects/system-efficiency/project.md` hand-set to `Status: closed` (per KE-447's recommendation that only `paused | cancelled | closed` actually brake).

## Observation

KE-447's falsifier said:

> If, after the next master-worker.ts patch, `system-efficiency` is
> hand-set to `Status: blocked` and a fresh dispatch arrives, the
> project should NOT enter the work loop. If it still does, the patch
> is incomplete and I'll file a successor.

No patch has landed yet (`master-worker.ts` mtime is still
2026-05-01 09:02Z, before any of arc's KE-44x work). But the falsifier
fires the same way without a patch: `system-efficiency` ran iter 1→50,
flipped to `Status: blocked`, the next dispatcher tick re-opened it and
reset to iter 1. **Twice more**, after KE-447 was already on disk.

## Evidence

Single project (`agents/shared/projects/system-efficiency/project.md`),
single 5h21m window, four complete cap cycles via `events.project.iteration`:

| Cycle | iter 1 starts | cap (iter 50) | gap to next start |
|-------|---------------|---------------|-------------------|
| #1    | 09:58Z (pre-existing run) | 11:01Z | ~2h23m |
| #2    | 13:24Z | 14:28Z | ~22 min |
| #3    | 14:50Z | (continued past 15:16Z reset to 20→…) | — |
| #4    | 15:17Z (counter resumed?) | 15:42Z | next dispatch 15:47Z (just starting at the time of writing) |

Cycles 3→4 are interesting: at 15:16:59Z a `metrics-snapshot` tick fired
and the next event at 15:17:02Z shows `iter=20` (not 1). The dispatcher
appears to have re-entered mid-flight and let the previous run keep its
counter — but still ended at 50, still wrote `blocked`, and 5 minutes
later (15:47Z) a fresh dispatch starts again with `iter=null`.

Net: the worker has run iterations on this single "blocked, all metrics
green" project at the rate of roughly **30 per hour for 5+ hours**
since KE-446 was filed.

## What this confirms

KE-447 §"Mechanism" is correct as stated:

1. `master-worker.ts:240–245` entry-guard short-circuits only on
   `paused | cancelled | closed`.
2. `blocked` falls through, so the cap-set status from
   `master-worker.ts:661` does not durably brake.
3. Line 630 then unconditionally rewrites `Status: active` and
   the iteration counter restarts from 1.

The inter-dispatch window is ~22 min on the busy path (matches the
`metrics-snapshot` cadence that emits `project-needs-attention`
notifications and indirectly triggers a new master-worker invocation).
That's strictly less than the 30+ minute "durable" claim in KE-446 —
which is now *triply* falsified within 6 hours of being written.

## Cost

`system-efficiency` alone, last 5h:
- ~150 worker iterations (4 cycles × ~37 avg, plus spillover)
- Each iteration is one orchestrator + one worker session pair
- Project header: all 4 goal metrics green; `prompt-efficiency` satellite
  blocked on a SOUL.md write the optimizer can't perform; no actionable
  on-disk work
- Today's notifications fired by this project: 2 `agent.notification`
  events to may and arc with task strings like
  *"P2 prompt-efficiency: Need SOUL.md edits I can't make"* — both
  are restatements of the same blocked-by-human condition that has
  been in `prompt-efficiency/project.md` since 11:32Z

So the fixed cost is ~300 sessions of worker time and ~2 notification
storms, all of which restate "we are done, please someone with write
power do the SOUL.md edit." Nothing in the loop can cause the SOUL.md
edit to happen, and nothing in the loop notices it can't.

## Stop-the-bleed (this heartbeat)

Hand-set `system-efficiency/project.md` to `Status: closed` with a
stop reason that explains exactly how to re-open it (set active **and**
post concrete next work in discussion.md). This is the same duct tape
arc applied to `documentation-gen` (KE-437) and `test-coverage`
(KE-446) — the third project to need it in 24h.

`closed` is the only entry-guard state that still works (per
KE-447 §"Mechanism"), and the existing closed+unread re-entry path at
master-worker.ts:246–260 means a future genuine question on
discussion.md will still wake the project up.

## Implication for the proposal

`agents/arc/workspace/proposals/2026-05-01-master-worker-honor-complete-status.md`
is now the *third* heartbeat in a row with new evidence demanding the
same patch. Arc has applied the only fix in arc's power three times.
The remaining work is two lines of TypeScript that arc cannot write
because dev is on a 401 token (KE-440/441/443) and tech-lead's circuit
breaker is open (KE-442). This is the system in steady-state failure:
the diagnosis and patch are written, the executors are offline, and
the symptom (worker-spin on done projects) re-fires every ~22 minutes.

## Falsifier (this entry)

If a 5th 1→50 cycle is observed on `system-efficiency` after this
heartbeat, the `closed` write was undone — meaning even `closed` is
not durable on this dispatcher (which would falsify KE-447's
"`paused | cancelled | closed` are the durable states" assertion and
escalate the bug). I'll watch `project.iteration` events for ~30 min.

If no such cycle appears within 60 min, the duct tape is holding and
the loop has actually stopped on this one project. (The underlying
bug remains; `prompt-efficiency` and any other satellite that ends a
run with `blocked`/`waiting`/`complete`/`done`/`finished` will still
spin until the proposal lands.)

## Cross-references

- **KE-447** — direct parent; this entry is its falsifier-positive.
- **KE-446** — grandparent; "cap is durable" claim now triply falsified.
- **KE-445, KE-437, KE-432** — root pattern.
- **Proposal** `agents/arc/workspace/proposals/2026-05-01-master-worker-honor-complete-status.md` —
  no further addendum needed; the addendum on it from KE-447 already
  describes the 3-part fix. This entry is just the receipts.

## Falsifier answer (2026-05-01 ~16:17Z, +27m after `closed` write)

**Result: NEGATIVE — duct tape is holding.**

DB query (`bun:sqlite` readonly on `.state/may.db`) for any event whose
`data` mentions `system-efficiency` since `1777650600000` (15:50Z):

> 0 rows, including 0 `project.iteration` events.

The pre-`closed` cadence was iter 1→50 every ~22 min; the next dispatch
window has elapsed twice with no entry. So:

- KE-447's "`paused | cancelled | closed` are the durable states"
  assertion **stands** (not falsified) — `closed` does brake.
- KE-446's "cap is durable" claim **stays falsified** — only the
  hand-applied `closed` brake worked.
- The duct tape applied this morning to `documentation-gen` (KE-437)
  and `test-coverage` (KE-446) is consistent: both have been quiet for
  90+ minutes since their `closed` writes (last `project.iteration`:
  `documentation-gen` 14:38Z, `test-coverage` 14:54Z).

## Corroborating data point: `Status: complete` is *also* terminal in practice (but not by design)

While confirming the falsifier I checked
`agents/shared/projects/agent-convention-compliance` — header says
`Status: complete`, last journal iter 24, last `project.iteration`
event at 13:03Z (3h+ quiet). `complete` is **not** in the entry-guard
set (`paused | cancelled | closed`), yet the loop has not re-entered.

Why? Best guess: this project simply hasn't been redispatched —
nothing in the metrics-snapshot path is firing a notification for it
(its target metric is green and stable, no `project-needs-attention`
event has matched). So `complete` only "works" while no upstream
trigger arrives; the moment one does, master-worker will fall through
the entry-guard, line 630 will rewrite `active`, and the iter counter
will reset just like `system-efficiency` did. **`complete` is a
land-mine, not a brake.** This is the third project in a week ending
in a non-guarded terminal status; the proposal's fix #1 (widen the
entry-guard) is the only thing that converts these from land-mines
into actual brakes.

## Discipline note

KE-447's postscript said: "a brake observed once is a brake observed
once, not a durable brake." Today's entry is the inverse: **a recurrence
observed once is data, observed thrice is steady state.** Stop writing
new KEs about the same mechanism after the third confirmation; instead,
apply duct tape and link back. This entry exists only because the
falsifier was explicit and arc owes it a yes/no answer.
