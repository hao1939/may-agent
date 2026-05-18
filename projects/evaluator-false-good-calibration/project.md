---
id: evaluator-false-good-calibration
owner: evaluator
status: active
type: milestone
priority: P2
workflow: evaluator-false-good-calibration-iteration
iteration: 1
---

# Evaluator False-Good Calibration

## Goal
Reduce evaluator false-good churn by hardening success-candidate scoring so sessions initially marked `good` are not frequently overturned to `acceptable` or `needs_improvement` during review.

## Signals
- Runtime metric `evaluator.false-good-rate-sample` was `0.4732` on 2026-05-18, with target `0.05` and threshold `0.60`.
- The metric is not currently paging, but it is far above target and indicates evaluator scoring is still over-crediting some sessions.
- `evaluation.false_good` events are emitted when a heuristic `good` route is later reviewed as `acceptable` or `needs_improvement`.
- Prior calibration work separated this from `evaluator.low-quality-rate-24h`; broad/substantive metric governance is done and should not be reopened here.

## Current State
Active: iteration-1 audit is complete. The dominant false-good mechanism is artifact-signal contamination: `transcriptOutputSignals()` can infer `project artifact` or `knowledge update` from arbitrary transcript text such as `git status --short` output, so unrelated dirty paths make routine heartbeat/no-op sessions look like material-output successes.

Reviewer guidance for iteration 2:
- Signal hardening should come first; add the heartbeat/no-op guard only after the contamination regression is covered by tests.
- Use the existing test seam in `agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts`.
- Use `events.timestamp` for runtime event trend checks, not `created_at`.
- Do not change thresholds.

## Plan
- [x] Audit the most recent 10-20 `evaluation.false_good` events and their corresponding aftermath/deep-eval artifacts.
- [x] Classify root causes: shallow/no-op success, ambient dirty worktree adoption, verification overclaim, schema/query recovery over-credit, or reviewer strictness/noise.
- [x] Locate the exact success-candidate and false-good emission rules in `agents/evaluator/workflows/evaluator-aftermath.ts`.
- [ ] Replace regex-based `project artifact` / `knowledge update` extraction in `transcriptOutputSignals()` with actual assistant `write`/`edit`/`apply_patch` path detection so bash/git-status text cannot create material-output signals.
- [ ] Add a heartbeat/no-op routing guard in `classifyEvaluationLane()` so non-material good sessions stay `routine_ok` unless the finish-blocked self-repair path applies.
- [ ] Add focused regression tests for dirty-path transcript contamination and positive tests for legitimate project/knowledge writes in `agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts`.
- [ ] Run the focused aftermath tests and record exact command/output.
- [ ] Verify post-change event trend using `events.timestamp` without changing the threshold.

## Next Action
Implement the signal-hardening change in `agents/evaluator/workflows/evaluator-aftermath.ts`: derive `project artifact` and `knowledge update` only from actual assistant `write`/`edit`/`apply_patch` tool-call paths, then add regression tests in `agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts` proving `git status --short` dirty paths no longer trigger material-output success-candidate routing.

After tests pass, write `outputs/2026-05-18-iteration-2-hardening.md` with before/after examples and exact test command/output.

## Validation
- A sample audit identifies the dominant false-good pattern with concrete session IDs.
- The chosen scoring change is backed by before/after examples.
- If runtime code changes, tests or fixtures cover the false-good pattern.
- `evaluator.false-good-rate-sample` trends toward target without threshold relaxation.

## Artifacts
- outputs/2026-05-18-iteration-1-false-good-audit.md

## Context
- `evaluator.false-good-rate-sample` is measured in `agents/may/handlers/metrics-snapshot.ts` from `evaluation.false_good` events divided by reviewed-good volume.
- Iteration-1 audit found 29/30 recent false-good cases were routed by material-output reasons involving project artifacts and/or knowledge updates, often from ambient dirty-path transcript text rather than actual writes.
- Current threshold is intentionally relaxed to `0.60` to prevent paging on small or noisy samples, but the target remains `0.05`.
- Related prior project `evaluator-low-quality-rate-calibration` is closed; do not reopen broad low-quality metric governance unless new evidence contradicts the existing split.
- Existing focused coverage lives in `agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts`, so this calibration should land with regression tests rather than audit-only evidence.
- Runtime `events` time filtering uses `events.timestamp` in epoch milliseconds.

## Linked Context
- `agents/evaluator/workflows/evaluator-aftermath.ts` - success-candidate routing, review, and `evaluation.false_good` emission.
- `agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts` - focused routing/signal tests and the right place for dirty-path contamination regression coverage.
- `agents/evaluator/knowledge/criteria.md` - evaluator criteria and success-candidate false-good guard language.
- `agents/evaluator/workspace/aftermath/` - reviewed session artifacts.
- `agents/evaluator/workspace/deep-evals/` - deeper evaluation artifacts when available.
- `projects/evaluator-false-good-calibration/outputs/2026-05-18-iteration-1-false-good-audit.md` - audit evidence showing artifact-signal contamination is the dominant false-good mechanism.
- `.state/may.db` / `events.timestamp` - source for recent `evaluation.false_good`, `evaluation.reviewed`, and `evaluation.success_candidate` event counts and trend checks.
