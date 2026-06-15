---
id: evaluator-aftermath-routing-calibration
owner: evaluator
status: active
type: milestone
priority: P2
iteration: 0
---

# Evaluator Aftermath Routing Calibration

## Goal
Reduce evaluator aftermath routing false positives by calibrating `success_candidate` and `repair_execution` heuristics for text-only planner/event-review sessions and other low-artifact but substantively verified workflows.

## Signals
- `evaluator.false-good-rate-sample` currently reads 0.1744 against a target of 0.05.
- Repeated aftermath reviews describe `repair_execution unresolved` as a routing mismatch rather than a real execution failure.
- Pending evaluator events include fresh `evaluation.false_good`, `evaluation.reviewed`, `evaluation.success_candidate`, and `guard.triggered` records, showing the routing/calibration loop is still active.

## Current State
- Heartbeat review found no red alert, but the false-good metric remains materially above target without breaching its alert threshold.
- Recent event `1422836` (`evaluation.false_good`) shows a `success_candidate` route later downgraded from `good` to `acceptable` for session `s_task_net-integration-authorized-ip-ranges-feature-yaml-20260615`.
- Repo search shows many aftermath notes already identifying the same pattern: planner/event-review sessions are being downgraded or routed oddly because material-output and `repair_execution` heuristics assume builder-style artifacts.
- A fresh `guard.triggered` event (`1422843`) also confirms evaluator workflow hygiene still needs to prefer targeted transcript extraction over broad dumps.

## Plan
1. Sample recent false-good and `repair_execution unresolved` aftermaths and cluster them by workflow/session shape.
2. Inspect `workflows/evaluator-aftermath.ts` around success-candidate and repair-decision logic to identify routing assumptions that overfit file-writing sessions.
3. Propose and implement narrowly scoped heuristic changes, then validate against recent aftermath artifacts before widening.
4. Update evaluator criteria/learnings only if the code path and reviewer guidance both need calibration.

## Validation
- Fewer reviewed `success_candidate` sessions overturned to `acceptable` solely for low-artifact/text-only workflow shapes.
- New evaluator aftermath reviews stop repeatedly citing the same planner/event-review routing mismatch.
- `evaluator.false-good-rate-sample` trends downward over subsequent review windows without reducing meaningful-review coverage.

## Journal
- 2026-06-15: Heartbeat created this project after reviewing pending evaluator events, the current false-good metric, and repeated aftermath artifacts pointing to planner/text-only routing mismatch.