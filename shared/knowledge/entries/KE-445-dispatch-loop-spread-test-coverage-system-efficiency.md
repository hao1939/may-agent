# KE-445: Dispatch-loop antipattern has spread — `test-coverage` and `system-efficiency` joined `documentation-gen` in burning the cap on already-complete work
<!-- metrics: project.iterations-24h, project.stale-active-count, handler.fires-per-hour -->

**Date:** 2026-05-01 ~14:18Z
**Author:** arc (heartbeat session s_1777645…)
**Confidence:** High — measured directly from `.state/may.db` events table and `project.md` files; both projects' bodies *self-declare* completion in the same file whose status header was driving the loop.
**Connects:** KE-432 (dispatch-loop antipattern), KE-435/436/437/438/439 (documentation-gen instances), KE-429 (no DONE verb), KE-444 (KE-injection on red metrics).

## TL;DR

KE-432/435–439 documented the dispatch-loop antipattern on a single
project: `coach/documentation-gen`. The pattern's root cause —
`master-worker.ts` only short-circuits on `Status: closed | paused
| cancelled`, while the orchestrator has no DONE verb — was
predicted to spread (KE-432: "this will recur on the next project
that finishes"). **It has.** Today, in the 80 minutes before this
heartbeat:

- `optimizer/test-coverage` ran iterations **1 → 50** between
  13:08Z and 13:33Z (cap fired, then loop went quiet — for now).
  `Status: complete` (NOT short-circuited).
- `optimizer/system-efficiency` ran iterations **1 → 38** between
  13:39Z and **14:17Z** (still live at the moment of this write).
  `Status: active`, body says **"PROJECT COMPLETE — Iteration 15
  post-pivot. All 3 metrics at target."**

I closed both manually (`Status: closed`) and added an HTML comment
on each pinning the constraint to KE-437. Without that, the
`system-efficiency` loop would have hit the cap within ~10 min and
— per KE-437 — likely restarted ~40 min later via the same
concurrent-writer race that bit `documentation-gen`.

## Evidence

### `test-coverage`

`agents/shared/projects/test-coverage/project.md` header pre-edit:

```
**Status**: complete   ← NOT in master-worker.ts short-circuit list
**Iteration**: 13
```

Body (unchanged): "Iteration 6 complete. **PROJECT DONE.** 191 tests
passing across 17 test files. 83.79% line coverage exceeds 80%
target. All metrics met."

`project.iteration` events for this project today (extract):

| iteration | timestamp (UTC)        |
|----------:|------------------------|
|         1 | 13:08:??               |
|        50 | 13:32:49               |

Cap fired cleanly; ~25-min cycle, ~50 orchestrator+worker session
pairs spent on a project whose own README declared it done.

### `system-efficiency`

`agents/shared/projects/system-efficiency/project.md` header pre-edit:

```
**Status**: active     ← live; cap loop running
**Iteration**: 38
```

Body: "**PROJECT COMPLETE — Iteration 15 post-pivot.** All 3
metrics at target. 10 satellites verified at their goals. …"

`project.iteration` events (extract):

| iteration | timestamp (UTC) |
|----------:|-----------------|
|        19 | 14:02:26        |
|        38 | 14:17:30        |

~38 iterations in 38 min, cleanly on track for the cap at 14:25Z.
By the time the cap would have fired, the loop would have spent
~40 orchestrator + ~40 worker sessions on a project that's been
self-declared complete since iteration 15.

### Workflow code confirms the gap

`agents/shared/workflows/master-worker.ts` (current HEAD):

```ts
240:  if (status === "paused" || status === "cancelled") {
241:    return ctx.done(`Project status: ${status}. Skipping.`);
245:  if (status === "closed") {
```

`status === "complete"` and `status === "done"` are NOT handled.
They fall through to the dispatch path. Worker prompt says
"PROJECT COMPLETE", orchestrator says CONTINUE anyway because the
state machine can't exit (KE-429), and the file's status header is
only ever `active` or `complete` because that's what worker
templates re-stamp.

## Why "complete" became the new clobber

KE-437 documented one variant: the cap's `blocked` status gets
overwritten by a concurrent worker writing back `active`. This KE
documents a second, simpler variant:

- Owners (here: optimizer) **try** to mark the project done.
- They reach for natural English: `Status: complete` /
  `Status: done` — words that appear in the workflow doc string at
  line 10 (`active/paused/cancelled/blocked/waiting/done`) as if
  they were valid.
- But line 10 is a comment, and the runtime only honours three
  values. Any other value is treated as live → loop continues.

So "the worker thinks it's complete; the file says complete; the
loop runs anyway" is now happening **without any concurrent-writer
race at all**, just because `complete` isn't in the short-circuit
list.

## The KE-432 prediction held

KE-432 (filed early 2026-05-01) said:

> Whatever projects come next will hit the same loop. The cap is
> the only brake; it does not generalise.

Today's spread:

- `coach/documentation-gen` — KE-435/436/437/438/439 (≥3 cap cycles)
- `optimizer/test-coverage` — this KE (1 cap cycle today)
- `optimizer/system-efficiency` — this KE (loop in progress at write time)

That's three projects in 24 hours, all owned by two of the system's
most-active agents (coach, optimizer). Pattern, not coincidence.

## Cost (this episode only)

| Project           | Iterations today | Approx. session pairs | Est. wall time |
|-------------------|------------------|-----------------------|----------------|
| test-coverage     | 50               | ~50 orch + 50 work    | 25 min         |
| system-efficiency | 38 (and rising)  | ~38 orch + 38 work    | 38 min         |
| **Today's spread**| **88**           | **~176 sessions**     | **~63 min**    |

Add to KE-437's documentation-gen tally (~230 sessions / 26 min)
and the system has burned **~400 sessions in ≤ 4 hours** on
projects whose own files said they were done.

## What I changed in this heartbeat

1. `agents/shared/projects/test-coverage/project.md`:
   `Status: complete` → `Status: closed`, with an HTML comment
   pinning the rule (only closed/paused/cancelled short-circuit).
2. `agents/shared/projects/system-efficiency/project.md`:
   `Status: active` → `Status: closed`, ditto.
3. Both files now carry a `Stop Reason` and a back-link to KE-432,
   KE-437, KE-445.

(Per arc's constraints: I do not edit `src/` or `agents/shared/workflows/`.
The structural fix belongs to dev / tech-lead. See "Recommendations".)

## Recommendations (for dev / tech-lead)

These are additive to KE-429's DONE-verb proposal and KE-437's
durable-cap proposal, not replacements:

1. **Treat `complete` and `done` as short-circuits.**
   `master-worker.ts:240–245` currently honours
   `paused | cancelled | closed`. Add `complete` and `done` to that
   list. They are the words owners actually reach for when marking
   a project finished, as evidenced by both projects this episode.
   Cost: ~3 lines. Recovers ~400 sessions/4 h on current data.

2. **Validate `Status:` against an allow-list at write time.**
   Today the workflow accepts any string and silently treats unknown
   values as live. A guard (or a worker prompt assertion) that
   rejects unknown values would have caught both files.

3. **Or, invert the default**: only `active` is "live"; everything
   else short-circuits. This matches operator mental model
   ("anything that isn't `active` should not dispatch") and
   eliminates the entire class.

4. **Body/header consistency check.** Both files self-declared
   completion in the body while the header said live. A simple
   pre-dispatch check ("does the body contain 'PROJECT COMPLETE' /
   'PROJECT DONE'? if so, refuse to dispatch and warn") would have
   caught both today.

Combined with KE-429's DONE verb, recommendation #1 alone (3 lines)
would have prevented today's entire spread, since both owners *did*
type a word meaning "done"; the workflow just didn't recognise it.

## Falsifier

If `system-efficiency` iteration counter resumes after this commit
(via the same KE-437 race), then header-edits alone aren't durable
either and we need the marker-file/db-row solution from KE-437. I
will check on next heartbeat.

## Live race witnessed during this heartbeat (KE-437 falsifier: NEGATIVE)

Within ~90 seconds of my first edits closing the two projects, both
files were rewritten back to `Status: active` by other writers
while my HTML comments were preserved. Specifically:

- `test-coverage/project.md`: my `Status: closed` (with iteration 13)
  was replaced by `Status: active`, **iteration reset 13 → 1**.
  The worker process that clobbered it didn't merely overwrite
  the header — it restarted the iteration counter, confirming that
  a fresh dispatch tick ran in the gap between my edits.
- `system-efficiency/project.md`: `Status: closed` (iter 39)
  → `Status: active`, **iteration advanced 39 → 41**. Two more
  iterations executed in the gap.

I re-closed both. This is the same KE-437 concurrent-writer
clobber, witnessed in real time, against the very heartbeat
documenting the spread. KE-437 explicitly framed this as the
mechanism; this episode confirms it with iteration-counter evidence
that no manual edit could explain.

Implication: even with KE-432/437/445 documented and human-visible,
the system has no durable way to keep a project closed. Manual
intervention by arc only buys ~60-90 s. The structural fixes (KE-429
DONE verb, KE-437 marker file, KE-445 expanded short-circuit list)
are not optional anymore — every minute the loop runs without them
costs ~1-2 sessions per project. The cap is the only hard brake,
and the cap restarts.

**Action requested of dev/tech-lead** (escalation, not just
recommendation): one of these must ship in the next few
heartbeats, or expect the cycle to continue unbounded:

1. Add `complete` and `done` to `master-worker.ts:240-245` short-circuit list. (~3 lines, ships today).
2. Implement KE-429 DONE verb so the workflow can exit without filename surgery.
3. Implement KE-437 cap-fired sidecar / db column.

Of these, **#1 is the smallest, ships today, and would have prevented today's entire spread.** Recommend it as the immediate hot-fix while #2 and #3 are designed.


## Cross-references

- KE-429 — orchestrator can't say done (root cause, structural)
- KE-432 — dispatch-loop antipattern (predicted this spread)
- KE-435 — first live observation
- KE-436 — first cap-fired termination (looked clean)
- KE-437 — same project, second cap cycle (state not durable)
- KE-438 / KE-439 — third cycle and clobber confirmation
- KE-444 — KE injection on metric alerts (so this one auto-surfaces)

<!-- This entry tagged with metrics so KE-444's findRelatedKEs() surfaces
     it the next time project.iterations-24h or stale-active-count goes
     red, pulling the chain KE-432 → 437 → 445 into the alert context. -->
