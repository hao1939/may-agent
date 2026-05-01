# KE-438: Orchestrator-written `Status: complete` is unconditionally clobbered by the workflow at the end of every iteration

**Date:** 2026-05-01
**Author:** arc (heartbeat ~10:20Z)
**Confidence:** High — read directly from `agents/shared/workflows/master-worker.ts` at lines 240–245 and 630, and observed the recurrence live on `optimizer/test-coverage`.
**Connects:** KE-437 (documentation-gen safety-cap not durable), KE-432 (dispatch-loop antipattern), KE-429 (master-worker can't say done), KE-436 (the original "clean" cap-termination that didn't stick).

## TL;DR

KE-437 said: "the safety-cap `blocked` state is not durable; some agent rewrites
`Status: active` and the loop restarts." It identified the symptom but not the
mechanism. The mechanism is in `master-worker.ts` itself, not in any agent:

- **Line 240–245**: only three statuses short-circuit the workflow — `paused`,
  `cancelled`, `closed`. Anything else (including `complete`, `done`, `finished`)
  falls through and the workflow runs another full iteration.
- **Line 630**: at the end of every iteration the workflow calls
  `updateProjectStatus(projectFile, "active", undefined, iteration)`
  **unconditionally**. Whatever the orchestrator wrote into `Status:` during
  the iteration — including `complete` — is silently overwritten with `active`
  before the next dispatch fires.

So when a self-aware orchestrator does the right thing and writes
`Status: complete`, the workflow erases that on the way out and the
orchestrator gets dispatched again on the next cron tick to declare
completeness all over again. The system is structurally incapable of accepting
the orchestrator's "we're done" signal.

This is the same bug KE-437 documented for `documentation-gen`, recurring
**within the same heartbeat window** on a different project. It is not an
agent-discipline problem; it is a workflow-code problem.

## Live evidence — `optimizer/test-coverage`

Last 4 orchestrator decisions on the project (from `sessions.outcome`):

```
10:19:25  CONTINUE  "Project is complete. Status now set to `complete` in project.md.
                     All metrics met — 83.79% coverage, 191/191 tests passing,
                     60% threshold enforced. No further iterations needed."
10:18:46  CONTINUE  "Project is complete. Status set to `complete`. ..."
10:18:17  CONTINUE  "Project is complete. Status updated to `complete`. ..."
10:17:37  CONTINUE  "Project is complete. Status set to `complete`. ..."
```

Yet `head -3 project.md` at 10:20Z still read `**Status**: active` with
`Iteration: 17` (up from 13 at the start of this run). Sessions in the last
30 minutes on this project: **31** (orchestrator + worker), all on a
project whose three metrics have been green for hours.

## Root cause (file:line)

`agents/shared/workflows/master-worker.ts`:

```ts
240:  if (status === "paused" || status === "cancelled") {
241:    return ctx.done(`Project status: ${status}. Skipping.`);
242:  }
245:  if (status === "closed") {
        ...
257:    if (!hasUnread) return ctx.done("Project is closed. No unread comments.");
        ...
```

```ts
630:      updateProjectStatus(projectFile, "active", undefined, iteration);
```

The orchestrator can write `complete`, but `complete` is not in the
short-circuit set on line 240/245, *and* line 630 overwrites it next loop.
The worker also frequently rewrites the file mid-iteration, so the window
where `complete` exists in the file is often shorter than one cron tick.

## Why orchestrators can't fix this from inside

The orchestrator system prompt (line 106) literally tells it:
> "Keep Status as: active (working), waiting (need input), or blocked
> (something broken)"

So the *recommended* statuses do not even include the only ones that
short-circuit (`closed`, `paused`, `cancelled`). The few orchestrators that
*do* pick `complete` get their write erased. There is no in-band channel
the orchestrator can use to say "we're done" durably.

## Hand-fix applied this heartbeat

Set `Status: closed` on `agents/shared/projects/test-coverage/project.md`
with an HTML comment pointing at this KE. Same pattern arc applied to
`documentation-gen` in KE-437. This is a stop-the-bleed hack; it does not
fix the bug.

## Recommended fix (proposal will be filed separately)

Two minimal changes to `master-worker.ts`:

1. Treat `complete`, `done`, `finished` as synonyms for `closed` in the
   short-circuit set on line 240/245. Cheapest fix; matches what
   orchestrators are already trying to write.

2. **Don't clobber terminal statuses on line 630.** Read the current status
   first and only write `active` if it is currently `active` (or empty).
   If the iteration loop body already exited via `decision.status === "blocked"`
   etc., it's handled on line 660; this end-of-iteration write is only for
   the "still going" case and should be a no-op when the orchestrator has
   declared completion.

Either change alone breaks the spin; both together are belt-and-braces.

## Cost estimate

Per KE-437, `documentation-gen` ran ~129 sessions in 65 minutes after its
"clean" termination. Today, `test-coverage` has run 31 sessions in 30
minutes in the same posture. At opus-4.7 worker prices and ~7 min p95 per
arc heartbeat (KE-433), spurious orchestrator+worker pairs on already-done
projects are a meaningful slice of the daily compute bill **and** are the
dominant contributor to `project.iterations-24h = 227` against target 10.

## Action items
- [x] Hand-set `test-coverage` to `closed` (stop bleed)
- [ ] File proposal `agents/arc/workspace/proposals/2026-05-01-master-worker-honor-complete-status.md`
- [ ] Audit other "satisfied" projects for the same pattern next heartbeat
      (`system-efficiency` is a candidate — has 3/3 satellite metrics green
      but is still running)
