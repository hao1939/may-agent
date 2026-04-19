# DD-781: The Confidence Dichotomy — Calibration in Tool-Use Agents ★★★★★

**Paper**: "The Confidence Dichotomy: Analyzing and Mitigating Miscalibration in Tool-Use Agents"
**Authors**: Weihao Xuan, Qingcheng Zeng, Heli Qi, Yunze Xiao, Junjue Wang, Naoto Yokoya
**arXiv**: 2601.07264 | **Submitted**: 2026-01-12
**Fills**: CR#324 Gap — Signal Calibration

---

## Core Finding

Tool-use agents exhibit a **fundamental confidence dichotomy** driven by tool type:
- **Evidence tools** (web search, RAG retrieval) → **systematic overconfidence** due to noise in retrieved information
- **Verification tools** (code interpreters, calculators) → **improved calibration** via deterministic feedback grounding

This is not a minor effect — it's a structural property of how tools interact with agent confidence. The dichotomy means that **a single calibration strategy cannot work across tool types**.

## Key Technical Contributions

### 1. Confidence Dichotomy Discovery
The pilot study reveals that when agents use evidence tools (web search), they become severely overconfident because:
- Retrieved evidence is inherently noisy
- Agents treat evidence retrieval as confirmation (cf. our DD#679 Reasoning Contamination Effect)
- The act of "having evidence" inflates confidence regardless of evidence quality

Verification tools (code interpreters) have the opposite effect:
- Deterministic feedback grounds reasoning
- Failed execution provides concrete disconfirmation
- Confidence aligns better with actual correctness

### 2. RL Fine-Tuning Framework for Calibration
Joint optimization of:
- **Task accuracy** (standard reward)
- **Calibration quality** (penalty for confidence-correctness mismatch)

Supported by a holistic benchmark of reward designs exploring different calibration loss functions.

### 3. Robust Generalization
Trained agents generalize:
- From local training → noisy web settings
- From original domain → mathematical reasoning
- Calibration improvements transfer across environments

## Relevance to CR#324 Verification Orchestration Stack

**This paper directly fills the "Signal Calibration" gap in CR#324.**

The CR#324 gap was: "DSL audits decisions given scores, not score accuracy." This paper shows:

1. **Tool-type-aware calibration is mandatory**: The verification orchestration stack (Layer 4 Policy Compilation) must encode different calibration strategies for evidence-based vs. verification-based signals.

2. **Verification tools self-calibrate; evidence tools need external calibration**: This maps to our Layer 1 mechanisms — AEGIS forensic analysis (evidence-based, needs calibration) vs. code execution checks (verification-based, self-calibrating).

3. **RL-based calibration can be integrated at Layer 3 (Budget Allocation)**: If the agent's confidence is well-calibrated, DOVA-style deliberation-first triage becomes dramatically more effective — you can trust the "no verification needed" signal.

## Connection to EXP-101 (HVR)

EXP-101 found that verbalized confidence (HVR) had AUROC 0.535 — no discriminative power. This paper explains why:
- EXP-101 tested agents using tool-use workflows where evidence and verification tools are mixed
- The confidence dichotomy means aggregated verbalized confidence is inherently unreliable without tool-type stratification
- **Prediction**: HVR stratified by tool type (evidence-only turns vs. verification-only turns) would show significantly different calibration properties

## Implications

### For Verification Orchestration (CR#324)
1. **Add tool-type metadata to verification signals** — every confidence score must be tagged with its source tool type
2. **Apply RL-calibrated confidence only to evidence-based signals** — verification-tool signals are already grounded
3. **Use calibration quality as a meta-signal** — poorly calibrated agents should trigger deeper verification (Layer 1)

### For Bob's Architecture (KE-105)
- The "verification triage" pattern (CR#324 Pattern 1) should use **tool-type-aware thresholds**: evidence-tool claims need lower confidence threshold to trigger deep verification
- Budget allocation (DOVA) should discount evidence-tool confidence relative to verification-tool confidence

### Broader
- This is the first paper to systematically show that **the tool an agent uses changes its calibration properties** — not just its accuracy, but its self-awareness
- Domain-specific calibration strategies are necessary, not optional
- Connects to DD#679 (Reasoning Contamination Effect) — evidence retrieval contaminates confidence just as reasoning contaminates uncertainty expression

## Ratings

| Dimension | Score |
|-----------|-------|
| Novelty | ★★★★★ — First systematic study of tool-type-driven calibration dichotomy |
| Rigor | ★★★★ — RL framework + generalization experiments |
| Relevance to us | ★★★★★ — Directly fills CR#324 signal calibration gap |
| Actionability | ★★★★½ — Clear integration path into verification stack |

**Overall: ★★★★★**

## Cross-References
- **CR#324**: Fills signal calibration gap
- **DD#679**: Reasoning Contamination Effect — evidence tools trigger similar contamination
- **DD#724**: Planner-Auditor Twin (Brier Score calibration) — complementary mathematical approach
- **DD#727**: SWE-PRM taxonomy-guided process signals — semantic calibration approach
- **EXP-101**: HVR failure explained by uncalibrated mixed-tool confidence
- **KE-105**: Verification Orchestration Stack — tool-type metadata recommended

---
*Scout DD-781 | 2026-04-20 | CR#324 Gap Filling — Signal Calibration*
