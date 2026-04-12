# CR#319: Verbalized Confidence Literature Synthesis — Grounding for EXP-101 / H-094

**Date**: 2026-04-09
**Session**: 389
**Deep Dives**: DD#679, DD#680, DD#681 (+ catalogued: 2604.01457, 2603.17839, 2604.03904)
**Target**: Bob (EXP-101 execution), Hao (research direction)

## Executive Summary

Six papers from the verbalized confidence / linguistic calibration literature directly ground EXP-101's HVR validation approach. The synthesis provides **three key findings**, **one critical warning**, and **three methodology enhancements** for EXP-101.

## Three Key Findings

### 1. HVR Is a Real Signal — Multiple Mechanistic Validations
- **DD#679**: Reasoning-time uncertainty markers reflect genuine late-layer reorganization (not surface-level noise)
- **2603.17839** (Cached Confidence): Verbal confidence is cached during answer generation, reflecting automatic self-evaluation beyond token probabilities
- **2604.01457** (Overconfidence Circuits): Specific MLP+attention circuits in middle-to-late layers drive confidence expression
- **Conclusion**: HVR-style detection captures a real internal signal, not just linguistic quirks

### 2. Local > Global — Reasoning-Time Signals Are Higher-Value
- **DD#679**: Local uncertainty markers (during reasoning) detect failures that global confidence (end-of-answer) misses
- The "silent failure" problem: some outputs are confidently wrong with no hedging
- **Local interface induces fundamentally different processing** (late-layer reorganization vs. decoding refinement)
- **For EXP-101**: Mid-trace hedging markers should be more predictive than conclusion-only hedging

### 3. Passive Detection Has a Ceiling — Trained Markers Would Outperform
- **DD#679**: Trained `<uncertain>` markers outperform passive hedging detection
- **DD#680**: Most LLMs underperform on natural linguistic confidence expression
- **Implication**: If EXP-101 shows AUROC < 0.60, the limitation is not in the concept but in passive detection quality. Active prompting/training would raise the ceiling.

## One Critical Warning: Reasoning Contamination Effect

**DD#681** (Miao & Ungar, 2026): 

> Calibration and verbalized confidence are encoded linearly but **ORTHOGONALLY**. When models reason and verbalize confidence simultaneously, reasoning **disrupts** the confidence signal.

This is the **Reasoning Contamination Effect (RCE)** — and it applies directly to agent traces:
- Agent traces = extended reasoning with embedded hedging markers
- RCE predicts hedging markers within reasoning will be **noisier** than standalone confidence assessments
- **Predicted impact**: EXP-101 AUROC 0.55-0.65 (vs. SELFDOUBT's cleaner benchmark performance)
- **Mitigation**: Position-weighted HVR (late-trace hedging > early/mid-trace hedging)

## Three Methodology Enhancements for EXP-101

### Enhancement 1: Weighted Hedging Scores (from DD#680)
**Current**: Binary hedge detection + count-based HVR  
**Proposed**: Each hedge expression gets a calibrated confidence weight

| Hedge Expression | Approximate Weight |
|---|---|
| "definitely", "certainly" | 0.95 |
| "I believe", "most likely" | 0.80 |
| "probably", "I think" | 0.65 |
| "perhaps", "maybe" | 0.45 |
| "I'm not sure", "possibly" | 0.30 |
| "I doubt", "unlikely" | 0.15 |

Replace `HVR = hedge_count / (verify_count + 1)` with:
`Weighted_HVR = sum(1 - weight_i) / (verify_count + 1)`

### Enhancement 2: Position-Weighted Analysis (from DD#681)
**Rationale**: RCE predicts late-trace hedging is more reliable  
**Implementation**: Compute three HVR variants in EXP-101 Phase 1:
- `HVR_full` — full trace (baseline)
- `HVR_late` — last 20% of trace tokens  
- `HVR_early` — first 20% of trace tokens

**Test**: If `AUROC(HVR_late) >> AUROC(HVR_full) > AUROC(HVR_early)`, RCE is confirmed on agent data.

### Enhancement 3: Dual-Signal Detection (from DD#679)
**Rationale**: Local and global signals provide complementary information  
**Implementation**: In addition to HVR (local), detect explicit confidence statements (global):
- "I'm confident this is correct"
- "I've verified this works"
- Final-answer certainty markers

Combine: `Combined_Score = α × HVR_local + (1-α) × Global_Confidence`

## Updated H-094 Assessment

| Aspect | Before (DD#656 only) | After (DD#679-681 synthesis) |
|---|---|---|
| Signal validity | Assumed real | **Confirmed real** (mechanistic evidence) |
| Expected AUROC | 0.60-0.70 (benchmark extrapolation) | **0.55-0.65** (RCE discount for agent traces) |
| Methodology | Binary hedge counting | **Weighted + position-adjusted** |
| Ceiling | Unknown | **Passive detection has ceiling; trained markers would raise it** |
| Key risk | May not generalize | **RCE is main limitation; mitigatable with position weighting** |

**P(H-094) remains 0.45** — evidence supports the concept but RCE adds uncertainty about magnitude in agent contexts.

## Connections to Existing Work

- **DD#656 (SELFDOUBT)**: Foundation paper — DD#679-681 validate and extend
- **DD#667 (MASC)**: Local uncertainty markers → MASC-style real-time correction
- **DD#671 (Structure Snowballing)**: Alignment tax may contaminate confidence expression (connects to RCE)
- **DD#674 (Hallucination Signal Distillation)**: Hidden-state probing avoids RCE entirely — complementary approach
- **EXP-101**: Three concrete methodology enhancements above

---
*Scout CR#319 | Session 389 | 2026-04-09*
