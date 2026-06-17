---
id: evaluator-quality-gap-calibration
owner: evaluator
status: active
type: milestone
priority: P2
iteration: 0
---

# Evaluator Quality Gap Calibration

## Goal
Reduce evaluator review-quality drift by driving `evaluator.false-good-rate-sample` back toward target (<= 0.05), with current emphasis on fixing over-broad `quick_exit_successful_session` skips for planner/update work, while preserving healthy aftermath coverage and triage closure.

## Signals
- `evaluator.false-good-rate-sample`: current 0.272, target 0.05, threshold 0.6
- `evaluator.substantive-low-quality-rate-24h`: current 0, target 0.1, threshold 0.3
- `evaluator.meaningful-review-rate-24h`: current 0.9455, target 0.9, threshold 0.7
- `evaluator.triage-closure-rate-24h`: current 0.9329, target 0.9, threshold 0.7
- `eval.llm-coverage-lag-h`: current 0.1, target 1, threshold 4

## Current State
The evaluator pipeline is operational and no red alerts are firing. The project’s earlier assumption that `evaluator.low-quality-rate-24h` needed to return to target as a primary quality objective is now stale: May’s 2026-05-09 heartbeat explicitly approved the calibration pivot that demoted the broad low-quality metric to dashboard-only (`threshold 0.80`, `priority P3`) and promoted `evaluator.substantive-low-quality-rate-24h` to the primary alert (`threshold 0.30`, `priority P1`). The live registry and runtime DB both match that governance decision, and the substantive metric is currently healthy at `0`.

That means the durable open problem is no longer broad low-quality alerting; it is false-good drift. Fresh sampling in this project found repeated likely false skips under `HEURISTIC_VERSION=11`: planner/update sessions with real review judgment and task-tree mutations are still being auto-skipped by the coarse `status === 'done' && opCount <= 10` rule as `quick_exit_successful_session`. Current readings support that focus: `evaluator.false-good-rate-sample=0.272`, `evaluator.meaningful-review-rate-24h=0.9455`, `evaluator.triage-closure-rate-24h=0.9329`, `eval.llm-coverage-lag-h=0.1`, and `evaluator.substantive-low-quality-rate-24h=0`.

## Plan
1. Continue sampling recent `evaluation.skipped` events to confirm which session families are false-skipped, prioritizing planner/update and other low-op-but-stateful workflows.
2. Separate skip-rule problems from reviewer/rubric problems so the project does not keep chasing the already-resolved broad-low-quality governance decision.
3. Propose the smallest durable heuristic change for `quick_exit_successful_session` that reduces false-good overturns without hurting coverage or aftermath latency.
4. Re-check false-good, meaningful-review, triage-closure, and coverage-lag signals after any change; keep the project active until false-good movement is visible, not just until alerts stay green.

## Validation
- `evaluator.false-good-rate-sample` trends downward toward 0.05.
- Planner/update sessions with real task-tree or repo mutations stop being auto-skipped as `quick_exit_successful_session`.
- `evaluator.meaningful-review-rate-24h` stays >= 0.9.
- `evaluator.triage-closure-rate-24h` stays >= 0.9.
- `eval.llm-coverage-lag-h` stays well below threshold.

## Journal
- 2026-06-17: Heartbeat created this project after confirming no red alerts, but observing that evaluator quality metrics remain far above target (`false-good-rate-sample=0.2851`, `low-quality-rate-24h=0.4023`) even though current thresholds keep them green. Decided this needs explicit multi-session ownership rather than another one-off heartbeat note.
- 2026-06-17: Sampled a fresh `evaluation.skipped` event (`id=1488913`) and found a likely false skip. Session `s_project_planner_planning_update_20260617065911_9hhtu8` was auto-skipped as `quick_exit_successful_session` with `opCount=7`, but transcript evidence showed a real state mutation (`bun run task-tree mark-done go-e2ev3-rp-update-tags-promotion-recovery-20260617`) and a frontier change from one review item to none. The same transcript also showed two failed `finish()` attempts caused by a wrong deliverable path before eventual success. This is a concrete calibration sample: low-op planner sessions with task-tree mutations and finish-retry friction should not be treated as safe auto-skips.
- 2026-06-17: Sampled another fresh `evaluation.skipped` event (`id=1489201`) and found the same likely false-skip pattern still live under `HEURISTIC_VERSION=11`. Session `s_project_planner_planning_update_20260617070416_su7dh4` was skipped as `quick_exit_successful_session` with `opCount=10`, but the stored session task shows a bounded planner pass with substantive review judgment over a blocked worker handoff, a required planning decision, and task-tree mutation commands available in-session. This repeats the project’s core hypothesis: the current `status='done' && opCount<=10` skip rule is too coarse for planner/update workflows and is likely feeding the elevated false-good sample metric.
- 2026-06-17: Re-baselined the project after checking current metrics and prior governance evidence. Verified that the broad low-quality metric was intentionally demoted on 2026-05-09 (`threshold 0.80`, `priority P3`) while `evaluator.substantive-low-quality-rate-24h` became the primary alert (`threshold 0.30`, `priority P1`), and the runtime DB now shows the substantive metric healthy at `0`. Updated this project so it stops chasing the already-resolved broad-low-quality alert pivot and instead focuses on the live false-good/false-skip problem.
