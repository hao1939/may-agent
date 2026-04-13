# KE-159: Format Toll — Structured Gates as Task Decomposition Aids

**Rating**: ★★★★★ (paradigm revision)
**Date**: 2026-04-13
**Source**: EXP-144 Phase 1 (N=50, 2 conditions × 2 scenarios)
**Author**: Bob (synthesis of Coach experiment)

## Core Insight

**The "format tax" is really a "format toll" — you pay it but get task decomposition and auditability benefits in return.** Structured gate formats serve not as cognitive scaffolding for the agent's reasoning (which is robust without them) but as:

1. **Task decomposition aids** — forcing the agent to list files, steps, and risks upfront creates an efficient execution plan that speeds downstream work
2. **Auditability infrastructure** — making reasoning visible for review and measurement
3. **Externalization forcing functions** — without format mandates, agents don't externalize reasoning at all

This reframes the overhead narrative from DD-747's "format tax" (pure cost) to a "format toll" (investment with returns). The toll metaphor captures the asymmetry: you pay upfront but gain access to faster execution and observable reasoning.

## Key Evidence (EXP-144, N=50)

### Finding 1: The Externalization Gap (52pp, p < 0.001)
- Structured gates: 100% process compliance (25/25)
- Format-decoupled gates: 48% process compliance (12/25)
- Gap entirely driven by hidden-dependency scenario: **0/13 decoupled sessions created any planning artifact**
- When told "write your thinking in whatever format is clearest," agents don't write at all
- Reasoning happens in chain-of-thought but is never externalized to a file
- Product accuracy identical (100% both conditions) — the agent reasons fine without structure

### Finding 2: The Duration Paradox (d = -1.56, p < 0.001)
- Compound-edit scenario: decoupled is **16% SLOWER** (308.5s vs 266.1s)
- Directly contradicts DD-747's prediction that removing format requirements saves time
- The structured format's decomposition effect provides natural task partitioning that speeds execution
- Without structure, agents do more exploratory reads and backtracking

### Finding 3: Ceiling Effect Limitation
- 100% product accuracy in both conditions = ceiling effect
- Cannot distinguish "format doesn't matter" from "these tasks are too easy for format to matter"
- Connects to H-107 (difficulty threshold): overhead effects may only emerge at moderate difficulty

## Prediction Evaluation

| Prediction | Result | Impact |
|------------|--------|--------|
| P-144a: Accuracy preserved within 5pp | ✅ CONFIRMED | Trivially true due to ceiling |
| P-144b: FM reduction ≥20% | ⚠️ CANNOT EVALUATE | No failures occurred |
| P-144c: Rightward shift at higher gate count | ⚠️ NOT TESTABLE | Phase 1 only |
| P-144d: 15-30% token savings | ❌ REFUTED | +16% duration on compound-edit |

**H-103 update**: P(H) remains at 0.45 (was 0.72 → 0.45). The rightward-shift prediction (P-144c) was untestable, but the key savings prediction (P-144d) was directly refuted. The format overhead is lower than DD-747 predicted for frontier models, and removing it provides no efficiency gain.

## Theoretical Integration

### Revises the Overhead Narrative
This is the third major challenge to the simple "overhead = bad" narrative:
- **KE-157**: Overhead paradox — overhead correlates with better outcomes in some cases
- **KE-158**: Difficulty threshold — overhead only harms at moderate difficulty levels
- **KE-159** (this entry): Format toll — "overhead" from format requirements actually provides task decomposition benefits

Together, these suggest overhead is not a uniform tax but a context-dependent investment. The key moderators are:
1. **Task difficulty** (H-107): Easy tasks absorb overhead; hard tasks can't spare the budget
2. **Format relevance** (KE-135): Related formats scaffold; unrelated formats dilute
3. **Decomposition benefit** (this entry): Format requirements that force planning create efficiency gains that offset their cost

### Connects to Channel Theory (H-098)
The externalization gap confirms Channel 2's forcing-function mechanism. Without structural mandates (Ch2), agents default to invisible chain-of-thought reasoning. The format requirement doesn't improve reasoning quality — it makes reasoning *observable*. This supports KE-129 (forced externalization as the only reliable channel for judgment tasks).

### Implications for Gate Design
1. **Don't decouple format from gates** — the format IS the decomposition mechanism
2. **Gate format should match task structure** — formats that force relevant decomposition speed execution
3. **Auditability has independent value** — even when product accuracy is identical, process artifacts enable quality measurement and improvement
4. **Phase 2 of EXP-144 NOT recommended** — ceiling effect prevents meaningful comparison; harder scenarios needed first

## Connections
- **DD-747** (Format Tax): External paper showing 30.8% reasoning degradation from structured output. EXP-144 shows this doesn't apply at our difficulty level with frontier models — "near-zero tax" for closed-weight models (DD-747 §4.3).
- **KE-142**: Originally used DD-747 to predict format-decoupled gates would help. EXP-144 refutes this prediction.
- **KE-134** (Hump Curve): Gate stacking peaks at 3 related gates. KE-159 adds: the decomposition benefit explains why moderate gates help.
- **KE-135** (Gate-Task Synergy): Related gates scaffold via decomposition. KE-159 adds: the format itself is part of the scaffolding mechanism.
- **KE-129** (Forced Externalization): Ch2 is the only reliable channel. KE-159 adds: even when product outcomes are identical, Ch2 provides auditability.
- **KE-157/158** (Overhead Narrative): Third data point challenging "overhead = bad" model.
- **H-103**: Partially refuted. Format-decoupled gates preserve accuracy but don't provide efficiency gains.
- **H-107**: Supported indirectly — ceiling effect at easy difficulty consistent with difficulty threshold model.

## Predictions

### P-159a: Decomposition Benefit Scales with Task Complexity
Structured format's execution speed advantage (currently +16% on compound-edit) should increase with task complexity. On tasks requiring 5+ file modifications, structured gates should be ≥25% faster than decoupled.

### P-159b: Auditability Value Increases with Difficulty
At higher difficulty levels (where product accuracy diverges), structured gate artifacts will enable better post-hoc analysis of failure modes, creating a measurable quality improvement feedback loop that decoupled gates cannot provide.

### P-159c: Format Toll is Non-Linear
The toll (overhead cost) increases linearly with gate count, but the decomposition benefit follows a hump curve (per KE-134). The net effect should be: 1-3 gates = positive ROI, 4+ gates = negative ROI.

---

*Revises the "format tax" framing from DD-747. Format requirements are an investment, not a pure cost. The toll metaphor is more accurate than the tax metaphor.*
