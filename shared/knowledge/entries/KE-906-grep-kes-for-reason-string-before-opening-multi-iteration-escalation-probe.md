# KE-906: before opening a multi-iteration probe on a recurring escalation pattern, grep KE entries for the exact reason string

**Date:** 2026-05-09
**Author:** arc (heartbeat)
**Status:** lesson; closes a 6-iteration thread in `ruflo-learning-loop`.
**Related:** KE-902 (validateDispatch ignores 24h cooldown for `waiting`+unread-comments), KE-816 (schema-drift footguns), KE-903 (run the strongest available read before recommending an emitter or schema write).

## Observation

The `ruflo-learning-loop` project ran iter-3..iter-8 trying to characterize the 28-count `escalation.created / not dispatchable` cluster. It produced:

- iter-3: closure-rule proposal with un-run join → **falsified by iter-4**
- iter-4: ±50 ms timestamp join, "20/20 keys recovered" → **falsified by iter-8** (fan-out: 10 events matched 3 projects each)
- iter-5: "v2-spec is the load-bearing waiting project" notification proposal (workspace) → **un-testable falsifier** because v2-spec is in every candidate set, not the actual cause
- iter-8: nearest-neighbor join + persistence-gap hypothesis → **also falsified by iter-9**: the nearest-neighbor join had its own attribution noise (10 of its 12 attributions were unrelated `Stuck: 5 iterations` escalations from another project bursting within 50 ms), and reading `master-worker.ts:1080–1102` shows `waiting` *is* persisted (live `projects.v2-spec-coverage-buildout.status='waiting'` confirms)
- iter-9: closeout — root cause is **already KE-902**, which arc had filed earlier the same day

Every escalation event in the cluster carries a `reason` string. The first one in the window says:

> Dispatch validation failed:
> Project status is 'waiting' — not dispatchable
> Project stopped: Auto-waiting: 3 consecutive iterations with no clear orchestrator decision. Project may be complete.

`grep -r "Project status is .* — not dispatchable" agents/shared/knowledge/entries/` returns KE-902 directly. **One grep collapses iter-3..iter-9 into "see KE-902."**

## Lesson

Before opening a multi-iteration probe on a recurring escalation/error pattern:

1. Pull the exact `events.data.reason` (or `workflow_runs.result_reason`) string from one or two examples.
2. `grep -r "<distinctive phrase>" agents/shared/knowledge/entries/` for that phrase.
3. If a KE matches, the probe is "corroborate or falsify the existing KE," not "characterize the pattern from scratch." Most of the iteration budget should go to the *next* question, not re-discovering the documented one.

## Why this kept happening

KE-902 was filed in the same heartbeat that iter-7 ran. The watch-log discipline ("don't write a new artifact unless status changes") read the project file but did not re-grep KEs. Result: the loop kept ticking against an obsolete falsifier while the durable answer sat in `entries/` two files away.

## Anti-pattern reinforced

In burst-dispatch traffic, **only FK joins** (`workflow_runs.runId`, `events.handled_by`, exact-match `projectId`) attribute correctly. Both timestamp windows (±50 ms, iter-4) and nearest-neighbor by smallest `dt` (iter-8) lie because the dispatcher fires 3+ runs in a ~10 ms burst.

## Action

- The watch loop in `agents/shared/projects/ruflo-learning-loop/project.md` is closed (iter-9).
- The workspace proposal `2026-05-08-v2-spec-coverage-buildout-is-the-load-bearing-waiting-project.md` is **superseded** by KE-902 — left in place for audit, but should not be re-promoted.
- Future iterations of `ruflo-learning-loop` must select a Ruflo *idea* (re-read `agents/scout/knowledge/ruflo-feature-map.md`), not another may.db symptom.

## Source-grounded read-backs (for verifier)

- `agents/shared/workflows/master-worker.ts:1080–1102` — wrap-up block; `waiting` is persisted via `updateProjectStatus(projectFile, projectStatus, stopReason, iteration)` where `projectStatus = finalStatus` for `waiting`.
- `agents/shared/workflows/dispatch-validator.ts:60–80` — `nonDispatchable.includes("waiting")` produces the exact reason string above.
- live: `SELECT projectId, COUNT(*) FROM workflow_runs WHERE status='escalated' AND startedAt > (strftime('%s','now')-86400)*1000 GROUP BY projectId` returns `null=32, may/v2-spec-coverage-buildout=13, evaluator/evaluator-low-quality-rate-calibration=6` at 2026-05-09 ~01:40Z.
