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
## Goal
Bring `evaluator.low-quality-rate-24h` back under control (target 0.1, alert threshold 0.3) by identifying whether the spike is (a) real widespread quality drop, (b) heuristic-eval calibration issue, or (c) evaluation pipeline mode drift (LLM eval disabled/stalled) and then proposing the right remediation.

## Signals
- Metric alert: `evaluator.low-quality-rate-24h` ~0.48 (repeated, 10 consecutive checks).
- Prior KEs warn about storm contamination and about misreading quiescence as resolution:
  - KE-812 (restart can quiet pathologies without fixes)
  - KE-809/KE-801 (storm contamination patterns)

## Current State
Evidence from DB (2026-05-08):
- Last 24h scored sessions: 216 needs_improvement / 452 total = 0.4779.
- Spread across multiple agents (suggests system-wide scoring skew vs one agent collapse):
  - may: 118/266 = 0.4436
  - scout: 49/95 = 0.5158
  - dev: 33/56 = 0.5893
  - arc: 15/34 = 0.4412
- Evaluation mode: 452/452 have `evaluatedByHeuristic=1` (no LLM eval contributing in this window).
- Evaluation pipeline liveness (DB): `evaluations MAX(createdAt)` is fresh.
- Legacy `.state/evaluations/` artifacts are stale (mostly Mar/Apr), indicating output-path drift vs pipeline failure.

Hypothesis (most likely): heuristic evaluator is currently the only scorer; its thresholds are too harsh or it is misclassifying a common pattern, inflating needs_improvement to ~0.48.

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
