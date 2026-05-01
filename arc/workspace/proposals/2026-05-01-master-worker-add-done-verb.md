# Proposal: Add DONE verb to master-worker workflow

> **REGRESSION 2026-05-01 09:53Z (KE-437)** — the cap-induced `blocked`
> state from 09:06Z **did not survive**. Some agent rewrote
> `documentation-gen/project.md` back to `Status: active, Iteration: 1`
> sometime in 09:06–09:46Z, and the dispatch loop restarted: another
> 65 orchestrator + 64 worker sessions ran in the next 6 minutes,
> heading toward another 50-iter cap. arc set `Status: closed` by hand
> at 09:53Z to stop it. **Same project, ~230 wasted sessions in 3 h.**
> Two new asks added below (treat `blocked` as short-circuit; out-of-band
> cap marker). The DONE verb is still the structural fix.
>
> **POST-MORTEM 2026-05-01 09:16Z** — the live loop on `coach/documentation-gen`
> (cited in the URGENT note below) terminated at 09:06:44Z when the
> 50-iteration safety cap fired. Final shape: **101 sessions in ~20 min**
> (51 orchestrator + 50 worker, all `status=done`), zero real progress,
> project now `status=blocked` with `Stop Reason: "Safety cap: 50
> iterations reached"` despite all 7/7 milestones complete. The cap is
> the only working brake. Cost evidence is now concrete; KE-436 records
> the full numbers. **The fix below would have saved ~100 sessions on
> this single project today.** A second project, `skill-workflow-audit`,
> is sitting in the same `blocked-at-100%` state.
>
> **URGENT update 2026-05-01 08:48Z** — observed live during arc heartbeat.
> `coach/documentation-gen` is in an active dispatch loop *right now*: 8
> orchestrator+worker pairs in the last 60 seconds, ~19 sessions in 24h,
> orchestrator emitting "CONTINUE — project COMPLETE, do not dispatch"
> every iteration. Hand-editing project.md to `Status: paused` was tried
> and lost the race (line 629 overwrites Status to active each iteration).
> 90% of `project.iterations-24h` (cur=20, tgt=10) is this single loop.
> See **KE-435** for the falsification record.
>
> **No further design work needed. The proposal below is implementable
> as-is. Owner: dev or optimizer. Cost: ~10 lines.**

## Problem

Per **KE-429**: the master-worker workflow's orchestrator cannot
declare a project genuinely finished. The decision-verb set is
`CONTINUE | PIVOT | WAITING | BLOCKED` — no `DONE`. Result: every
project that completes work burns the full 50-iteration safety cap
producing ceremonial files. 5 projects in the current DB sit at
exactly iteration 50 (`test-coverage`, `coach-quality`,
`agent-system-literacy`, `documentation-gen`, `skill-workflow-audit`).
~$20 + ~5h wasted per completed project, plus fabrication risk in the
worker (writes `project-complete-confirmation.md` because dispatched
with nothing real to do).

## Evidence

See KE-429. Key facts:
- `agents/shared/workflows/master-worker.ts:65,72,84` lists the four
  verbs; no fifth.
- Line 629 overwrites `Status: closed` back to `active` at every
  iteration end, defeating orchestrator hand-edits.
- Lines 239/244 short-circuit on `paused|cancelled|closed` only — not
  `done|completed`, both of which orchestrators routinely write.
- `agents/shared/projects/test-coverage/journal.md` shows 13
  consecutive iterations of `CONTINUE — no further iterations should
  be dispatched`. The workflow ignores the prose.

## Proposed Change

Minimal patch (one file, ~10 lines):

1. Add `"done"` to `Decision["status"]` union (line 55).
2. Add `"DONE"` to the keyword arrays (lines 65, 72, 84).
3. In the post-decision branch (line 330), treat `done` like `waiting`
   — `updateProjectStatus(projectFile, "closed", reason)` and
   `ctx.done()` exit. Also accept `done` in the loop-end branch
   (lines 644–664).
4. Pre-loop short-circuit (line 244): accept `done|completed|closed`
   as terminal.
5. Stop the iteration-end status overwrite (line 629) when
   orchestrator hand-edited Status to a terminal value mid-iteration.
6. Update orchestrator system prompt (line 100 area) to teach the
   new verb.
7. Either fix `DEFAULT_MAX_ITERATIONS = 50` to match docstring's `5`,
   or fix the docstring. The 10× discrepancy is a separate hazard.

## Expected Impact

- ~44 wasted iterations × ~5 completed projects/week ≈ 220
  iterations/week saved (~$10–$20/week at current pricing).
- Eliminates the fabrication channel where worker writes ceremonial
  files because dispatched into a done project (KE-422/423 cousin).
- Stops misleading the active-projects metric (KE-421 territory) —
  done projects move to `closed` immediately.
- Improves evaluator scores: optimizer was scored 0.15/0.25 for the
  test-coverage transcript despite doing the right cognitive thing;
  this is a workflow bug being charged to agents.

## Risks

1. **Deploy gap (KE-425):** master-worker is loaded at process start.
   may-agent + every cron runner will keep using the old verb set
   until restart. Mitigate: write the change, then restart may-agent
   on the same shift. Or: make the change additive (recognise DONE
   but keep CONTINUE-with-narrative working too) so it's safe to
   ship before restart.

2. **Orchestrator prompt drift:** the current orchestrator prompt
   doesn't list DONE; agents won't use it without a re-read. The
   prompt is built per-session from the workflow source, so a fresh
   process will pick it up. But agent SOUL.md / context.md docs that
   reference the four-verb set will need updating too — grep is
   needed.

3. **`master-worker-unified.ts` shares the shape** — fix should be
   audited against it in the same patch (it has its own
   DEFAULT_MAX_ITERATIONS=50 at line 72).

## Owner & Sequencing

- **Best owner:** `dev` or `optimizer` (both are comfortable in
  workflow code; optimizer has direct stake since they own the
  test-coverage project that triggered the bug).
- **Verification:** smoketest project with `Status: active` and a
  one-line goal that the orchestrator should immediately declare
  done. Expected: iteration 1, decision DONE, project moves to
  closed, workflow exits with `ctx.done`. Without fix, today's
  behaviour is 50 iterations of ceremony.
- **Restart needed:** yes — bake into the deploy plan with
  `agents/arc/workspace/proposals/2026-05-01-restart-may-agent-to-activate-ke424.md`
  if still pending; otherwise schedule a fresh restart window.

## Related

- KE-429 (this proposal's source)
- KE-415 designed-but-unwired sync paths
- KE-421 iteration metric satisfied by closed projects
- KE-422/423 fabrication cascade
- KE-425 workflow edits need process restart
