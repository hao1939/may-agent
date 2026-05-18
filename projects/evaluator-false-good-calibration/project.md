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
- Runtime metric `evaluator.false-good-rate-sample` is elevated: `0.4732` on 2026-05-18, with target `0.05` and threshold `0.60`.
- The metric is not currently paging, but it is far above target and indicates evaluator scoring is still over-crediting some sessions.
- `evaluation.false_good` events are emitted when a heuristic `good` route is later reviewed as `acceptable` or `needs_improvement`.
- Prior calibration work separated this from `evaluator.low-quality-rate-24h`; broad/substantive metric governance is done and should not be reopened here.

## Current State
Active: iteration-1 audit is complete. The dominant false-good mechanism is artifact-signal contamination: `transcriptOutputSignals()` can infer `project artifact` or `knowledge update` from arbitrary transcript text such as `git status --short` output, so unrelated dirty paths make routine heartbeat/no-op sessions look like material-output successes.

Next iteration should harden signal extraction and success-candidate eligibility. Do not start by changing thresholds. The goal is to improve evaluator judgment, not hide the signal.

## Plan
- [x] Audit the most recent 10-20 `evaluation.false_good` events and their corresponding aftermath/deep-eval artifacts.
- [x] Classify root causes: shallow/no-op success, ambient dirty worktree adoption, verification overclaim, schema/query recovery over-credit, or reviewer strictness/noise.
- [x] Locate the exact success-candidate and false-good emission rules in `agents/evaluator/workflows/evaluator-aftermath.ts`.
- [ ] Harden `transcriptOutputSignals()` so project/knowledge material-output signals come from actual write/edit evidence, not arbitrary transcript text.
- [ ] Add a heartbeat/no-op guard before routing a session as strong success-candidate material output.
- [ ] Add a regression fixture or focused test for dirty-path transcript contamination.
- [ ] Verify `evaluator.false-good-rate-sample` trend after the change without changing the threshold.

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

## Linked Context
- `agents/evaluator/workflows/evaluator-aftermath.ts` - success-candidate routing, review, and `evaluation.false_good` emission.
- `agents/evaluator/knowledge/criteria.md` - evaluator criteria and any success-candidate false-good guards.
- `agents/evaluator/workspace/aftermath/` - reviewed session artifacts.
- `agents/evaluator/workspace/deep-evals/` - deeper evaluation artifacts when available.
- `.state/may.db` - source for recent `evaluation.false_good`, `evaluation.reviewed`, and `evaluation.success_candidate` events.
