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

## Goal
Reduce false/unstable NI (needs_improvement) labeling by heuristic evaluator so that:
- `evaluator.low-quality-rate-24h` trends back below threshold (0.3) and toward target (0.1), and
- downstream coaching/triage actions are grounded in a stable signal.

## Signals
- `evaluator.low-quality-rate-24h` currently 0.5268 (> threshold 0.3; target 0.1).
- `evaluator.false-good-rate-sample` currently 0.6667 (> threshold 0.2; target 0.05), but already documented as an exception until sample size stabilizes (see metric blocker).

## Current State
- Last 24h evaluations are **100% heuristic** (`evaluatedByHeuristic=1`, `evaluatedByHeuristic=0` count = 0).
- Last 24h verdict mix (sessions that have evaluations): 238 NI vs 211 good (NI rate ~0.53).
- By-agent NI rates over last 24h (evaluated sessions): dev 0.615, scout 0.548, arc 0.541, may 0.504.
- Pipeline liveness: `evaluations` table is fresh (MAX(createdAt) lag ~50s), while `.state/evaluations/` artifacts are stale (latest files dated Apr 29 / Mar 24), consistent with known legacy-output-path drift.

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
