# Evaluator Aftermath Outputs False-Positive Review — 2026-05-12

## Trigger

Evaluator sent a P1 review request for session `s_1778575778461_3`: the route reason said `constraint violation: edited forbidden path(s): outputs/first-e2e-run-results.md`, while the task explicitly required writing that project output.

## Finding

The specific false-positive class has already been fixed in the evaluator aftermath workflow by commit `e8e68dde2`. Current source includes a targeted regression test named `does not treat required project outputs as forbidden when only project and journal edits are prohibited`, and the test file now covers the exact shape from `s_1778575778461_3`: required `outputs/first-e2e-run-results.md` plus a separate `You CANNOT edit the project file or journal` constraint.

## Evidence

- `agents/evaluator/workspace/aftermath/s_1778575778461_3.md` confirms the task-required output file was the only substantive deliverable and identifies the original route reason as likely false-positive.
- `agents/evaluator/workspace/aftermath/s_1778578479477_4.md` records that dev reproduced the bug, landed commit `e8e68dde2`, and verified `transcriptIssues(...)` returned `[]` for the reviewed transcript after the fix.
- `agents/evaluator/workflows/evaluator-aftermath.ts` now extracts forbidden paths only from explicit prohibition clauses rather than treating an entire serialized task line as forbidden context.
- `agents/shared/tests/evaluator-aftermath.test.ts` contains the regression for project output paths.
- `bun test shared/tests/evaluator-aftermath.test.ts` passed 34/34 on this heartbeat.

## Decision

Dismiss this inbox item as already acted. No new code change is needed unless a fresh false-positive appears after commit `e8e68dde2`.

## Follow-up Trigger

Reopen only if a post-`e8e68dde2` aftermath route still flags an explicitly required `shared/projects/<id>/outputs/*` deliverable as an edited forbidden path.
