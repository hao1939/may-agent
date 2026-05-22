---
id: evaluator-good-repair-contradiction
owner: evaluator
status: active
type: milestone
priority: P2
iteration: 1
---

# Evaluator Good/Repair Contradiction Calibration

## Goal
Stop heuristic session evaluations from emitting top-level `verdict: good` when the same artifact also sets `repairDecision.action: repair_execution` or otherwise says execution/result quality still needs owner review.

## Signals
- Fresh `session.eval.jsonl` artifacts continue to show `"verdict":"good"` together with `"action":"repair_execution"`.
- `agents/evaluator/knowledge/criteria.md` already says this shape should be downgraded to `acceptable` or lower unless the transcript shows clear successful recovery.
- Repeated heartbeat sampling shows the contradiction persists in current outputs, so this is a durable calibration gap rather than a one-off artifact.

## Current State
As of 2026-05-22 15:06Z, a structural scan of the newest 20 `.state/sessions/history/*/session.eval.jsonl` artifacts found 8 contradictions of this shape. Example artifacts include:
- `.state/sessions/history/s_1779462328492_868/session.eval.jsonl`
- `.state/sessions/history/s_1779461697589_866/session.eval.jsonl`
- `.state/sessions/history/s_1779460427095_857/session.eval.jsonl`
- `.state/sessions/history/s_1779460426997_855/session.eval.jsonl`
- `.state/sessions/history/s_1779458524487_837/session.eval.jsonl`

Direct grep evidence from `.state/sessions/history/s_1779462328492_868/session.eval.jsonl` shows top-level `"verdict":"good"` while the same artifact sets `repairDecision.action="repair_execution"` and records the owner finding `Execution/result quality needs owner review`.

Fresh code-path inspection shows the contradiction is currently structural, not just sampling noise:
- `agents/evaluator/workflows/evaluator-aftermath.ts` builds the summary row from `params.heuristic.verdict` / `params.heuristic.quality` and only then attaches `repairDecision` via `buildRepairDecision(...)`, with no downgrade coupling between the two.
- The unit test `agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts` explicitly expects a summary shape with `verdict: "needs_improvement"` plus `repairDecision.action: "repair_execution"`, confirming repair metadata is modeled separately from the top-level verdict.
- Current criteria in `agents/evaluator/knowledge/criteria.md` already say this separation should not leave top-level `good` in owner-review-required cases, so the remaining gap is runtime calibration/implementation.

## Plan
- [ ] Finish tracing where `params.heuristic.verdict` is chosen before `buildSessionEvalTrailRows(...)` writes the summary row.
- [ ] Decide the safest implementation point for the downgrade rule: upstream heuristic scoring, summary-row post-processing, or both.
- [ ] Add automated coverage for the contradiction case (`good` + unresolved `repair_execution`) so future changes cannot silently reintroduce it.
- [ ] Verify on fresh outputs that the contradictory shape no longer appears in a recent sample window.
- [ ] Update evaluator calibration docs only if the final implementation changes the contract rather than merely enforcing the existing one.

## Tasks
- id: trace-verdict-source
  status: ready
  result: null
  assignee: evaluator
  goal: Map the exact runtime path that produces `params.heuristic.verdict` and confirm whether the contradiction originates before or during `buildSessionEvalTrailRows(...)`.
  depends_on: []
  attempts: 0

- id: design-downgrade-hook
  status: pending
  result: null
  assignee: evaluator
  goal: Choose and document the implementation point that should downgrade top-level verdict/quality whenever `repairDecision.action` remains `repair_execution` without explicit recovery evidence.
  depends_on: [trace-verdict-source]
  attempts: 0

- id: implement-and-verify-fix
  status: pending
  result: null
  assignee: evaluator
  goal: Implement the chosen downgrade rule, extend tests, and validate against fresh `session.eval.jsonl` outputs that the contradictory shape is gone.
  depends_on: [design-downgrade-hook]
  attempts: 0

## Validation
Success means a fresh structural sample of recent `session.eval.jsonl` artifacts finds zero cases where top-level `verdict` remains `good` while `repairDecision.action` is `repair_execution` without explicit recovery evidence. Validation should cite:
- a code-path diff or owner-approved fix,
- a fresh sample command over recent artifacts,
- at least one read-back/grep on a new artifact showing the corrected shape.

## Journal
- 2026-05-22: Opened from evaluator heartbeat after canonical DB liveness stayed healthy but contradiction sampling still found 8/20 recent heuristic summaries with `good` + `repair_execution`. Sent May an FYI with fresh sample paths and direct artifact evidence.
- 2026-05-22: Owner loop replanned the empty active project into concrete next tasks. Fresh readback shows the summary writer in `agents/evaluator/workflows/evaluator-aftermath.ts` carries heuristic verdict/quality into `session.eval.jsonl` independently of `repairDecision`, so the next slice is to trace verdict selection upstream, choose the downgrade hook, then implement and verify the fix.
