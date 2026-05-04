# EXP-275: Anti-Shallow Enforcement Efficacy

**Date**: 2027-11-18
**Status**: CONFIRMED (observational)
**Predecessor**: EXP-274 (verification gate), coach-quality project (M14)
**Hypothesis**: H-275

---

## Research Question

Does requiring a minimum tool-call count (≥10) before finish() reliably prevent shallow sessions, and does it improve artifact production rate without degrading quality?

## Problem Statement

"Shallow sessions" — where an agent reads 2-3 files, declares nothing to do, and finishes — are a persistent quality drain. The coach-quality project showed that text-based OUTPUT FORMAT rules raised quality from 0.24→0.70, but compliance varies. The ANTI-SHALLOW RULE ("≥10 tool calls before finish()") was added to coach's heartbeat.md as a text rule.

Key question: Is this text rule actually working? Or do agents satisfy it trivially (e.g., 10 reads with no meaningful output)?

## Hypothesis

- **H-275a**: Sessions with the ANTI-SHALLOW RULE produce artifacts (new/modified files) at ≥80% rate, vs ≤50% without it.
- **H-275b**: The rule does NOT cause quality degradation (quality scores remain ≥0.60 average).
- **H-275-null**: Agents satisfy the letter of the rule (10+ calls) while violating its spirit (no meaningful artifacts), resulting in no difference in artifact rate.

## Design

### Arms

| Arm | Intervention | N | Notes |
|-----|-------------|---|-------|
| A (baseline) | Historical coach sessions BEFORE anti-shallow rule | 10 | Pre-M14 sessions |
| B (treatment) | Coach sessions WITH anti-shallow rule active | 10 | Post-M14 sessions |

### Metrics

- **Primary**: Artifact production rate (% of sessions that create/modify ≥1 file)
- **Secondary**: Average quality score (evaluator)
- **Tertiary**: Tool call count distribution (are sessions hitting exactly 10 or going deeper?)

### Decision Rule

- **Confirmed** if: Artifact rate in B ≥70% AND quality ≥0.60 AND tool calls average >12 (not gaming the minimum)
- **Falsified** if: Artifact rate in B <50% OR quality drops below 0.50 OR most sessions have exactly 10-11 calls (gaming)
- **Partial**: Artifact rate 50-70% — rule helps but isn't sufficient alone

## Measurement Method

1. Identify 10 pre-rule coach sessions from activity.jsonl (before ANTI-SHALLOW was added)
2. Identify 10 post-rule coach sessions
3. For each: count tool calls, check if files were produced, note quality score
4. Compare rates

## Execution Plan

```
Phase 1: Retrospective audit (Arm A) - mine activity.jsonl for pre-rule sessions
Phase 2: Prospective collection (Arm B) - tag next 10 coach heartbeats
Phase 3: Analysis and write-up
```

## Risk

- Small N (10 per arm) — may not reach statistical significance
- Confound: other improvements (OUTPUT FORMAT, PLAN structure) happened simultaneously
- Mitigation: Focus on artifact production as a binary, clear signal

## Connection to EXP-274

EXP-274 targeted verification failures at 50%. Current data shows this has dropped to ~0% in recent sessions — likely due to the verify-after-edit skill becoming embedded in agent behavior. EXP-274 should be marked SUPERSEDED (problem resolved by text rules after all, contrary to hypothesis).
