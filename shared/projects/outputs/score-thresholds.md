# Evaluation Score Thresholds — Coaching Triggers

## Overview

This document defines the score thresholds that trigger coaching interventions based on eval-poller output. Scores use the 0.0–1.0 scale defined in `agents/shared/skills/evaluator-scoring/SKILL.md`.

---

## Threshold Table

| Metric | Threshold | Action Triggered | Rationale |
|--------|-----------|-----------------|-----------|
| `quality` | < 0.3 | **Immediate coaching review** | Score indicates task was missed or mostly failed. Agent needs direct intervention. |
| `quality` | 0.3–0.5 | **Pattern tracking** | Partial completion — log the failure mode. If 3+ sessions in 7 days hit this band, escalate to coaching. |
| `quality` | ≥ 0.7 | No action | Agent performing adequately. |
| `efficiency` | < 0.3 | **Efficiency coaching** | Significant loops/waste. Coach should review for anti-patterns (FM-1.3 looping, FM-1.4 memory loss). |
| `efficiency` | 0.3–0.5 | **Pattern tracking** | Minor inefficiency — track but don't intervene unless recurring. |
| `verdict` | `"needs_improvement"` | **Coaching queue** | Regardless of numeric score, this verdict flags the session for review. |
| `result_delivered` | `false` | **Non-delivery alert** | Most critical signal. Agent claimed done but produced nothing (FM Silent Failure). Triggers immediate coaching. |

---

## Compound Triggers (Multiple Sessions)

| Condition | Action |
|-----------|--------|
| 3+ sessions with `quality < 0.5` in 7 days (same agent) | Generate coaching intervention with specific failure mode analysis |
| 2+ sessions with `result_delivered: false` in 7 days (same agent) | P0 coaching — likely systemic issue (wrong tools, broken assumptions) |
| Agent average quality drops >0.2 from 30-day baseline | Drift alert to coach — something changed |

---

## Failure Mode Prioritization

When coaching is triggered, prioritize issues by severity:

1. **P0 — Non-delivery** (`result_delivered: false`): Agent produces nothing. Usually indicates tool confusion, constraint violation, or hallucination loop.
2. **P1 — Fatal failures** (quality = 0): Hallucination, safety violation, silent failure. Requires immediate pattern correction.
3. **P2 — Scope drift** (quality 0.3–0.5): Agent works on wrong thing. Coaching focuses on task decomposition.
4. **P3 — Inefficiency** (efficiency < 0.3): Agent completes task but wastes resources. Coaching focuses on tool usage patterns.

---

## Implementation Notes

- The eval-poller writes evaluations to `.state/evaluations/` as JSON with fields: `agents.{name}.quality`, `agents.{name}.efficiency`, `agents.{name}.verdict`, `overall.result_delivered`
- Coaching consumer should scan new evals and apply thresholds above
- Thresholds are intentionally conservative — only flag clear problems to avoid coaching fatigue
- The 0.3 quality threshold maps to the rubric's "Poor: Task attempted but missed the main goal"
- The `result_delivered: false` check is the highest-signal indicator based on observed eval data (most "needs_improvement" sessions have this flag)

---

## Observed Distribution (from recent evals)

From sampled evaluations in `.state/evaluations/`:
- Multiple sessions show `quality: 0.1–0.2` with `verdict: "needs_improvement"` and `result_delivered: false`
- One session shows `quality: 0.55` with `verdict: "acceptable"` but still `result_delivered: false` (scope drift)
- Common failure modes: NON_DELIVERY, WRITE_FIRST_VIOLATION, HALLUCINATION, LOOPING

This confirms the 0.3 threshold will correctly capture the problematic sessions while not flagging acceptable work.
