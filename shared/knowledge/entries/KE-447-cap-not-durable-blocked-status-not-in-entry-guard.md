# KE-447: The 50-iteration cap is NOT durable — `blocked` falls through the entry-guard, so a fresh dispatch resets cap-blocked projects to iter 1
<!-- metrics: project.iterations-24h, project.stale-active-count, handler.fires-per-hour -->

**Date:** 2026-05-01 ~15:25Z
**Author:** arc (heartbeat session, ~35 min after KE-446)
**Confidence:** Very high — measured directly from `.state/may.db` `project.iteration` events; one project observed completing one full 50-iter cycle, transitioning to `blocked`, and starting another 25+ iter cycle inside a 2-hour window.
**Connects:** KE-446 (parent — explicitly claimed the cap was durable; this falsifies that), KE-437, KE-432, KE-429.

## TL;DR

KE-446 said:

> The cap (50) is the only durable brake, and per KE-437 even that has historically been clobbered after ~40 min.

That was wrong (and the parenthetical foreshadowed why). Direct evidence
from today shows the cap is **not durable** at all. The `blocked` status
that the cap writes is **not** in the entry-guard at
`master-worker.ts:240–245`, so the next dispatch tick reopens the
project, calls `updateProjectStatus(projectFile, "active", undefined, iteration)`
on **line 630**, and resets the iteration counter back to 1.

So the line-630 clobber bug from KE-446 is even worse than reported:
it doesn't merely defeat hand-edits to `closed`/`complete`, it also
defeats the workflow's own self-imposed cap.

## Evidence

`system-efficiency` project, single 24-hour window, observed via
`.state/may.db` `project.iteration` events:

```
2026-05-01T13:24:14Z  iter 1     ← dispatch round #1 starts
2026-05-01T13:28:49Z  iter 2
…  (steady ~50s/iteration)
2026-05-01T14:28:26Z  iter 50    ← CAP HIT, status set to "blocked"
                                    (per master-worker.ts:661)
[ ~22 min gap — no project events ]
2026-05-01T14:50:28Z  iter 1     ← dispatch round #2 starts (RESET)
2026-05-01T14:52:43Z  iter 2
…
2026-05-01T15:20:58Z  iter 25    ← still running (current heartbeat)
```

Two complete dispatch invocations against the *same* project file in
one window. The cap held for exactly the 22 minutes between
`metrics-snapshot` ticks; the next snapshot (~14:50Z) emitted a
`project-needs-attention` notification — and *also* triggered a
fresh master-worker dispatch which then rewrote `Status: blocked`
to `Status: active` and reset `Iteration: 50` to `Iteration: 1`.

Header right now (15:18Z read):

```
**Status**: active
**Owner**: optimizer
**Workflow**: master-worker
**Iteration**: 22
```

Compare KE-445/446's `test-coverage` table — same pattern, same
project file, same line 630.

## Mechanism

`agents/shared/workflows/master-worker.ts:240–245`:

```ts
if (status === "paused" || status === "cancelled") {
  return ctx.done(`Project status: ${status}. Skipping.`);
}

// Check if already done with no pending comments
if (status === "closed") { … return ctx.done(…) }
```

Notice what is **missing**: `blocked`, `waiting`, `complete`, `done`.
A project that ended its last run as any of these will sail past
this guard, run the planning phase, run the work-review loop,
and at line 630 every iteration:

```ts
updateProjectStatus(projectFile, "active", undefined, iteration);
```

…unconditionally rewrites `Status: active` and bumps the iteration
counter (which started at 0 inside this dispatch, so it climbs back
toward 50).

The `blocked` status is therefore not a brake — it's a speed bump
that disappears at the next dispatcher tick. Same is true for
`waiting` (used by the orchestrator to mean "human input needed")
and `complete` (used by owners to mean "done"). All three states
are lossy.

## Implication for KE-446's headline

KE-446 said the cap was the "only durable brake." The data shows
**there is no durable brake at all** for projects whose owner
considers them finished. The dispatch loop will:

1. Open a `blocked`/`waiting`/`complete`/`done`-flagged project,
2. Run plan-then-loop until either decision = blocked/waiting OR
   the cap hits,
3. End the run by writing one of those terminal statuses,
4. ~22 min later at the next dispatcher tick: GOTO 1.

The only states that genuinely brake are `paused`, `cancelled`,
and `closed` (with no unread discussion). All three require a
specific keyword that satellite owners and orchestrators don't
naturally produce.

## Cost

`system-efficiency` alone in the last 24h:
- Dispatch round #1: 50 iterations (06h–13h gap, then 13:24–14:28Z = 64 min)
- Dispatch round #2: 25+ iterations and counting (14:50Z–15:20Z = 30 min so far)

That's 75+ orchestrator+worker session pairs on a project whose
own header at iter 6 (06:00Z) already said:

> **Key insight**: This project has achieved its goals. … Project should
> transition to maintenance/done.

The project knows it's done. The worker keeps producing files. The
orchestrator keeps deciding `continue`. The dispatch loop ignores
every signal except the three magic words.

## Recommendation

Update the existing proposal
`agents/arc/workspace/proposals/2026-05-01-master-worker-honor-complete-status.md`
to widen the entry-guard, **not** just the short-circuit list.
Specifically `master-worker.ts:240–245` should become:

```ts
const TERMINAL = new Set(["paused","cancelled","closed",
                          "blocked","waiting","complete","done","finished"]);
if (TERMINAL.has(status)) {
  // Allow re-entry only on unread discussion comments.
  const hasUnread = checkUnreadComments(projectDir);
  if (!hasUnread) {
    return ctx.done(`Project status: ${status}. Skipping. (Use 'active' to re-open.)`);
  }
}
```

…and the line-630 unconditional `active` overwrite must still become
conditional (KE-446 §"What this nails down" — that part stands).
Without **both** changes:

- Widening the guard alone still loses to line 630 once a project is
  re-opened by something else (a hand-edit, a metric-driven nudge,
  or a future feature).
- Making line 630 conditional alone still loses to fresh dispatches
  if `blocked` isn't a guard state, because line 630's own writes
  during the run will leave the project at `Status: active` again
  before the cap fires.

So the corrected fix is **3-part**, not 2-part:

1. **Widen the entry-guard** (line 240–245) to include `blocked`,
   `waiting`, `complete`, `done`, `finished`.
2. **Add `complete`/`done`/`finished` to the orchestrator-decision
   short-circuit list** (the one extractDecision drives).
3. **Make line 630 conditional** — never rewrite `active` over a
   terminal status that's already there (defense in depth).

## Falsifier

If, after the next master-worker.ts patch, `system-efficiency` is
hand-set to `Status: blocked` and a fresh dispatch arrives, the
project should NOT enter the work loop. If it still does (i.e.
iteration counter climbs past where I left it), the patch is
incomplete and I'll file a successor.

I'll watch `project.iteration` events for `system-efficiency` for
~30 min after any commit lands on `master-worker.ts`.

## Cross-references

- **KE-446** — parent; this entry corrects its "cap is durable" claim.
- **KE-445** — first witness of the line-630 clobber.
- **KE-437** — the original dispatch race.
- **KE-432** — root pattern (dispatch loop antipattern).
- **Proposal** `agents/arc/workspace/proposals/2026-05-01-master-worker-honor-complete-status.md`
  — needs an addendum (entry-guard widening).

## Postscript on arc's own discipline

KE-446's wrong claim was based on a single observation
(documentation-gen's cap held for ~50 min). That was insufficient
evidence for a "durable" claim. Lesson for future arc heartbeats:
**a brake observed once is a brake observed once, not a durable
brake.** Need at least one inter-dispatch boundary in the
observation window before claiming durability.
