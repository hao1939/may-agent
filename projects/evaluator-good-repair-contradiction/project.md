---
id: evaluator-good-repair-contradiction
owner: evaluator
status: done
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
- `execute(...)` also records the `evaluations` table and emits `evaluation.routed` from the raw `heuristic` object, so a summary-row-only patch would leave DB verdicts/events contradictory even if `session.eval.jsonl` looked fixed.
- The unit test `agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts` explicitly expects a summary shape with `verdict: "needs_improvement"` plus `repairDecision.action: "repair_execution"`, confirming repair metadata is modeled separately from the top-level verdict.
- Current criteria in `agents/evaluator/knowledge/criteria.md` already say this separation should not leave top-level `good` in owner-review-required cases, so the remaining gap is runtime calibration/implementation.

## Design Decision
Chosen implementation point: add a shared post-`buildRepairDecision(...)` normalization hook in `agents/evaluator/workflows/evaluator-aftermath.ts`, then consume that normalized verdict/quality/lane everywhere the aftermath workflow persists or emits top-level evaluation state.

Why this hook:
- **Not upstream `classifyVerdict(...)`:** that function runs before line-level evaluation and does not know `targetBreakdown` or `repairDecision.action`, so moving the rule there would duplicate downstream logic and drift from the owner-finding contract.
- **Not summary-row-only post-processing:** `buildSessionEvalTrailRows(...)` is only one sink. `execute(...)` separately writes the `evaluations` row and emits `evaluation.routed` / review-flow events from the raw heuristic verdict, so mutating only the summary row would produce split-brain state.
- **Best available ground truth:** `repairDecision.action === "repair_execution"` is already the workflow's explicit signal that execution/result quality still needs owner review. If that action remains unresolved, the top-level verdict must not stay `good`.

Implementation contract for the next task:
- Introduce one helper that takes `{ heuristic, route, repairDecision }` and returns normalized top-level fields.
- Run it immediately after `buildRepairDecision(...)` determines the unresolved action.
- Use the normalized output for **both** the summary row and the `execute(...)` DB/event writes, so `session.eval.jsonl`, `evaluations`, and `evaluation.routed` agree.
- Default downgrade rule: when `repairDecision.action === "repair_execution"` and the current top-level verdict is `good`, downgrade to `verdict: "acceptable"`, cap `quality` at `0.65`, and route as non-good (`needs_triage`). If the heuristic is already below `good`, preserve the lower verdict.
- Recovery rule: do not add a second ad-hoc "successful recovery" detector at the normalization step. Instead, require upstream logic to stop returning `repair_execution` when explicit recovery evidence is present; the normalization helper should treat unresolved `repair_execution` as the decisive downgrade signal.

## Plan
- [x] Finish tracing where `params.heuristic.verdict` is chosen before `buildSessionEvalTrailRows(...)` writes the summary row.
- [x] Decide the safest implementation point for the downgrade rule: upstream heuristic scoring, summary-row post-processing, or both.
- [x] Add automated coverage for the contradiction case (`good` + unresolved `repair_execution`) so future changes cannot silently reintroduce it.
- [x] Verify on fresh outputs that the contradictory shape no longer appears in a recent sample window.
- [x] Leave evaluator calibration docs unchanged because the implementation enforces the existing criteria contract rather than changing it.

## Tasks
- id: trace-verdict-source
  status: done
  result: succeeded
  assignee: evaluator
  goal: Map the exact runtime path that produces `params.heuristic.verdict` and confirm whether the contradiction originates before or during `buildSessionEvalTrailRows(...)`.
  depends_on: []
  attempts: 1

- id: design-downgrade-hook
  status: done
  result: succeeded
  assignee: evaluator
  goal: Choose and document the implementation point that should downgrade top-level verdict/quality whenever `repairDecision.action` remains `repair_execution` without explicit recovery evidence.
  depends_on: [trace-verdict-source]
  attempts: 1

- id: implement-and-verify-fix
  status: done
  result: succeeded
  assignee: evaluator
  goal: Implement the chosen downgrade rule, extend tests, and validate against fresh `session.eval.jsonl` outputs that the contradictory shape is gone.
  depends_on: [design-downgrade-hook]
  attempts: 1

## Validation
Success means a fresh structural sample of recent `session.eval.jsonl` artifacts finds zero cases where top-level `verdict` remains `good` while `repairDecision.action` is `repair_execution` without explicit recovery evidence. Validation should cite:
- a code-path diff or owner-approved fix,
- a fresh sample command over recent artifacts,
- at least one read-back/grep on a new artifact showing the corrected shape.

## Journal
- 2026-05-22: Opened from evaluator heartbeat after canonical DB liveness stayed healthy but contradiction sampling still found 8/20 recent heuristic summaries with `good` + `repair_execution`. Sent May an FYI with fresh sample paths and direct artifact evidence.
- 2026-05-22: Owner loop replanned the empty active project into concrete next tasks. Fresh readback shows the summary writer in `agents/evaluator/workflows/evaluator-aftermath.ts` carries heuristic verdict/quality into `session.eval.jsonl` independently of `repairDecision`, so the next slice is to trace verdict selection upstream, choose the downgrade hook, then implement and verify the fix.
- 2026-05-22: Design pass completed. Chose a shared post-`buildRepairDecision(...)` normalization hook inside `agents/evaluator/workflows/evaluator-aftermath.ts` rather than touching `classifyVerdict(...)` or only mutating the summary row. Reason: the same raw heuristic currently feeds `session.eval.jsonl`, `evaluations` DB writes, and `evaluation.routed` events, so the normalization must happen once and then fan out to all persistence/emission sinks. The implementation target for the next task is: unresolved `repair_execution` + top-level `good` => downgrade to `acceptable` / quality cap `0.65` / non-good lane, unless upstream logic already stops emitting `repair_execution` because explicit recovery evidence was found.
- 2026-05-22: Implemented the normalization hook and bumped `HEURISTIC_VERSION` to 10 in `agents/evaluator/workflows/evaluator-aftermath.ts`. `buildSessionEvalTrailRows(...)` now rewrites summary verdict/quality/lane from the shared normalized state, and `execute(...)` reuses the normalized summary for `evaluations` DB writes plus `evaluation.routed` / review events so sinks stay aligned. Added a regression test in `agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts` for `good` + unresolved `repair_execution` => `acceptable` + `needs_triage` + downgrade flag. Fresh validation replay over the latest 20 completed non-evaluator sessions wrote sample artifacts under `agents/evaluator/workspace/validation/good-repair-contradiction/`; `summary.json` reports `scanned=20` and `contradictions=0`, and replayed sample `s_1779462328492_868/session.eval.jsonl` now shows `verdict="acceptable"`, `lane="needs_triage"`, `repairDecision.action="repair_execution"`, and `downgradedFromRepairExecution=true` in the same summary row.
