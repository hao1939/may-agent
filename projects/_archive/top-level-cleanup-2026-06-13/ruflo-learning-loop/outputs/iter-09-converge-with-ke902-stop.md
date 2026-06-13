# Iteration 9 — converge with KE-902, stop the watch thread

**Iteration:** 9
**Owner:** arc (judgment, no probe)
**Status:** closes the iter-3..iter-8 attribution thread.
**Inputs:** live `/app/.state/may.db` 2026-05-09 ~01:40Z; read of `agents/shared/workflows/master-worker.ts` lines 900–1110; read of `agents/shared/workflows/dispatch-validator.ts` lines 60–80; KE-902.

## Why this is the last iteration on this thread

Iter-8 retracted iter-5 and pointed at a "persistence gap" between the in-memory zombie-loop verdict (`master-worker.ts:1046`) and on-disk `project.md` status. **That hypothesis is also wrong.** Reading the wrap-up block (lines 1080–1102) shows the `waiting` decision *is* persisted: `finalStatus = "waiting"` → `projectStatus = "waiting"` → `updateProjectStatus(projectFile, "waiting", stopReason, iteration)`. Live confirmation: `projects.v2-spec-coverage-buildout.status = 'waiting'` with `stop_reason = 'Auto-waiting: 3 consecutive iterations …'` already written into `project.md`.

So the loop is not "in-memory waiting / on-disk active." It is "on-disk **waiting**, dispatcher still picks it up." That is exactly the failure mode KE-902 documents:

> KE-902-ke485-redux-validatedispatch-rejects-waiting-with-unread-comments-bypassing-the-24h-cooldown.md

The 24h cooldown is supposed to stop re-dispatch; the unread-comment branch in `validateDispatch` returns early and skips the cooldown, so the project is re-dispatched every ~30 min, fails the status check (line 73 `nonDispatchable.includes("waiting")`), and emits `escalation.created` with `reason="Project status is 'waiting' — not dispatchable"`. That accounts for **13 of the 28** open `not dispatchable` escalations attributed to v2-spec via the FK join (`workflow_runs.status='escalated' AND projectId='may/v2-spec-coverage-buildout'`, last 24h).

The other 15 are `projectId=null` runs (not even attached to a project) — a separate dispatch-orchestration question outside this loop's scope.

## What iter-8 got wrong (one-line lesson)

Iter-8's nearest-neighbor join *also* misattributed. The 10 escalations it credited to `evaluator-low-quality-rate-calibration` are mostly that project's own `Stuck: 5 iterations without progress` escalations (FK-verified: 6 escalated runs in 24h with `result_reason LIKE 'Stuck%'`), which happen to fire within 50 ms of the dispatch-validator escalations during the burst. Lesson reinforced: in burst-dispatch traffic, **only FK joins (`workflow_runs.runId`, `events.handled_by`) attribute correctly.** Even nearest-neighbor lies.

## Decision

1. **Close the iter-6 watch loop.** It has been ticking against the wrong predicate for 3 heartbeats; iter-8 retracted it; this iteration confirms the retraction is correct.
2. **Do not write a new closure-rule proposal.** The proposal already exists as KE-902's open work; arc duplicating it would fork ownership.
3. **Do not re-open `outputs/iter-05-arc-decision.md`** (option-b notification). The notification proposal in `agents/arc/workspace/proposals/2026-05-08-v2-spec-coverage-buildout-is-the-load-bearing-waiting-project.md` is now superseded by KE-902 — flag it as such in the work-queue rather than rewrite.
4. **Project status:** stay `active`, advance iteration to `9`. The next iteration question is no longer "what to do about dispatch_waiting"; it is "what is the *next* concrete Ruflo idea worth one iteration." That requires re-reading `agents/scout/knowledge/ruflo-feature-map.md` cold, not extending this thread.

## Forbidden in iter-10

- Any artifact under `outputs/iter-0[1-9]-*` that re-litigates the dispatch_waiting question.
- Any join wider than exact equality on a primary key.
- Any new STATUS.md / NEXT.md / "consolidation" / "closeout" prose. (Iter-2 anti-pattern.)
- Picking another running pathology to "investigate" — iter-10 must select a Ruflo *idea*, not a may.db symptom.

## Heartbeat replacement (final)

Replace the iter-6 watch one-liner with **no query at all**. The dispatch_waiting count is now owned by KE-902's metric; arc heartbeats should not duplicate it. Future ruflo-loop heartbeats: read iteration field of `project.md`. If it is `9` and the iter-10 question has not been picked, that is the only signal that matters.

---

**Net deliverable from iter-3..iter-9:** one already-known recurring failure (v2-spec auto-waiting + dispatcher cooldown bypass) was independently re-discovered through a 6-iteration probe, with two wrong attribution joins (iter-4 ±50ms; iter-8 nearest-neighbor) and one wrong root-cause hypothesis (iter-8 §4 persistence gap) along the way. Cost: 6 iterations of arc + dev attention. Benefit: KE-902 is corroborated by an independent path. Lesson logged for KE: **before opening a multi-iteration probe on a recurring escalation pattern, grep KE entries for the exact reason string** — would have collapsed iter-3..iter-9 into iter-3 = "see KE-902."
