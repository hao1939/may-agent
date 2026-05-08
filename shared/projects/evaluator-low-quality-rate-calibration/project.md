---
id: evaluator-low-quality-rate-calibration
owner: evaluator
status: active
type: milestone
priority: P1
workflow: project
iteration: 1
---

# Evaluator low-quality-rate (24h) calibration

**Status**: active
**Iteration**: 1
## Goal
Bring `evaluator.low-quality-rate-24h` back under control (target 0.1, alert threshold 0.3) by identifying whether the spike is (a) real widespread quality drop, (b) heuristic-eval calibration issue, or (c) evaluation pipeline mode drift (LLM eval disabled/stalled) and then proposing the right remediation.

## Signals
- Metric alert: `evaluator.low-quality-rate-24h` ~0.48 (repeated, 10 consecutive checks).
- Prior KEs warn about storm contamination and about misreading quiescence as resolution:
  - KE-812 (restart can quiet pathologies without fixes)
  - KE-809/KE-801 (storm contamination patterns)

## Current State
Iteration 2. Milestones: 0/0 done.
Reviewer: - **I believe**: The spike is primarily **real “process hygiene” incidents being counted as low-quality** because `evaluator-aftermath.ts` forces `verdict=needs_improvement` at **quality=0.55 whenever
## Plan
1. **Confirm intended evaluation mode**: is `evaluate-session-llm` disabled by design? If yes, update alerting/targets to match heuristic baseline; if no, escalate to re-enable/fix pipeline. (Owner: may/tech-lead)
2. **Find top heuristic “issues” driving needs_improvement**: aggregate `evaluations.issues` (JSON) to determine the dominant failure reasons.
3. **Spot-check**: sample 10 sessions scored needs_improvement across different agents, verify if the heuristic is over-triggering.
4. **Remediation proposal** (one of):
   - tune heuristic thresholds
   - re-weight verdict rules
   - temporarily adjust alert threshold while LLM eval is off
   - or re-enable LLM eval if it’s the intended canonical scorer

## Validation
- Metric returns below threshold 0.3 (and ideally toward target 0.1) for at least 24h.
- Evidence query: `needs_improvement / total` in last 24h computed from `sessions ⨝ evaluations`.

## Journal
- 2026-05-08: Established DB-ground-truth rate (0.4779 = 216/452) and confirmed all evaluations in window are heuristic. Notified May asking whether LLM eval is intended to be off and suggesting calibration/alerting adjustment.


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
- Heuristic scoring is implemented in `agents/evaluator/workflows/evaluator-aftermath.ts` with `HEURISTIC_VERSION = 3`.
- `classifyVerdict()` is a step function: terminal failure → quality 0.2 NI; any detected issue → quality 0.55 NI; no issues → quality 0.85 good.
- Top hygiene triggers are explicit transcript detectors: “finish() blocked [uncommitted changes]”, `/no such column|table/` (schema/query error), “workflow live signal injection unavailable”, etc.
- There is heuristic version drift: aftermath workflow writes hv=3 while fallback scan defaults hv=2; mixed versions persist in DB due to refresh rules.
- Next step: quantify last-24h low-quality attribution by (bucket/status/issues) and compute counterfactual metric impact for exempting top hygiene issues, then choose one intervention.
