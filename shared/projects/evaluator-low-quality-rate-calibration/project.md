---
id: evaluator-low-quality-rate-calibration
owner: evaluator
status: active
type: milestone
priority: P2
workflow: project
iteration: 1
---

# Evaluator low-quality-rate calibration

**Iteration**: 4
## Goal
Reduce false/unstable NI (needs_improvement) labeling by heuristic evaluator so that:
- `evaluator.low-quality-rate-24h` trends back below threshold (0.3) and toward target (0.1), and
- downstream coaching/triage actions are grounded in a stable signal.

## Signals
- `evaluator.low-quality-rate-24h` currently 0.5268 (> threshold 0.3; target 0.1).
- `evaluator.false-good-rate-sample` currently 0.6667 (> threshold 0.2; target 0.05), but already documented as an exception until sample size stabilizes (see metric blocker).

## Current State
Iteration 4. Milestones: 0/0 done.
Reviewer: [PIVOT] ### 1) I believe
- The spike is mostly **mechanical/definition-driven**: `evaluator.low-quality-rate-24h` is a gauge in `agents/may/handlers/metrics-snapshot.ts` that counts “needs_improvement
## Plan
1. Ground-truth check (requires coordination): obtain a small LLM-eval sample (even 20 sessions) to estimate heuristic precision/recall and isolate whether the NI spike is real agent regressions vs heuristic drift.
2. Heuristic rule audit: identify top NI issue patterns in the last 24h (e.g., verification discipline, tool misuse, self-reference traps) and confirm they correspond to actual transcript evidence.
3. If heuristic is too strict: propose criteria adjustment(s) in `agents/evaluator/knowledge/criteria.md` with before/after examples.
4. If agents truly regressed: route targeted feedback to agent owners with concrete examples.

## Validation
- `evaluator.low-quality-rate-24h` < 0.3 for 3 consecutive snapshots.
- LLM-eval sample disagrees with heuristic at <20% on verdict (or another agreed threshold).

## Journal
- 2026-05-08: Investigated red metric breach. Evidence shows the spike is not due to missing coverage (evaluations are fresh) but due to high NI share under heuristic-only evaluation; notified May and filed P0 request for structural guard against `to='functions.message'` misrouting.


## Artifacts
- outputs/iteration-1-diagnosis.md
- outputs/iteration-1-deliverable-heuristic-v2-calibration-plan.md
- outputs/iteration-3-impact-model-and-recommendation.md
- outputs/iteration-4-metric-split-implementation-plan.md
- outputs/iteration-2-mechanism-and-fix-options.md
- outputs/iteration-1-2026-05-08-evidence-refresh.md
- outputs/iteration-5-approval-packet.md
- outputs/iteration1-attribution-summary.md


## Context
- Add: `shared/projects/** is gitignored in this repo; worker cannot commit iteration outputs there; finish() can be blocked by accidental edits (project.md) and uncommitted changes. Future work should produce handoff artifacts under agents/evaluator/workspace/ and message May/human for landing code changes.`
- Add: `metrics registry for evaluator.low-quality-rate-24h confirmed in agents/may/handlers/metrics-snapshot.ts (ALL_METRICS entry); computation section still needs line-anchored extraction for PR-ready patch kit.`
