# DD#679: LLMs Should Express Uncertainty Explicitly — Dual Interface for Confidence Control

**Paper**: "LLMs Should Express Uncertainty Explicitly" (Guo et al., April 2026)
**arXiv**: 2604.05306
**Rating**: ★★★★★ EXCEPTIONAL
**Connection**: H-094 (HVR confidence gating), EXP-101 (HVR validation), DD#656 (SELFDOUBT)

## Core Contribution

Instead of treating uncertainty as a latent quantity to estimate post-generation, this paper studies uncertainty as a **trainable communication interface**. They compare two complementary interfaces:

1. **Global Interface**: Model verbalizes a calibrated confidence score for its final answer
2. **Local Interface**: Model emits an explicit `<uncertain>` marker during reasoning when entering a high-risk state

Key finding: **These interfaces work differently internally and provide complementary benefits.**

## Key Results

### Global Interface (Verbalized Confidence)
- Substantially improves calibration
- Reduces overconfident errors
- Yields strongest Adaptive RAG controller (retrieval triggered selectively)
- **Mechanism**: Mainly refines how *existing* uncertainty is decoded — the model already "knows" its confidence, this just surfaces it

### Local Interface (Reasoning-Time `<uncertain>` Markers)
- Makes previously **silent failures visible during generation**
- Improves wrong-answer coverage
- Provides effective high-recall retrieval trigger
- **Mechanism**: Induces a broader **late-layer reorganization** — fundamentally changes how the model processes, not just how it reports

### Combined Benefits
- Global confidence: deciding whether to trust a **final answer**
- Local signals: deciding when **intervention is needed during reasoning**

## Critical Implications for EXP-101 / H-094

### 1. HVR is Capturing the Local Interface (Not the Global One)
SELFDOUBT's Hedge-to-Verify Ratio measures hedging markers in reasoning traces — this is essentially a **noisy version of the local interface**. The paper shows this is the higher-value signal:
- Local markers catch failures *during* generation, not just at the end
- The "late-layer reorganization" means local uncertainty reflects deeper processing changes
- **Prediction for EXP-101**: Hedging markers in mid-trace (not just final answer) should be more predictive of session failure

### 2. Two-Interface Architecture for Agent Systems
Our system could implement both:
- **Global**: Agent verbalizes confidence score at end of each major step → used for escalation decisions
- **Local**: Track hedging/uncertainty markers during trace → used for real-time intervention (connect to MASC-style correction, DD#667)
- EXP-101 is testing the local interface retrospectively

### 3. Silent Failure Detection
The paper's biggest insight: some failures are **silent** — the model produces confidently wrong output with no hedging. The local interface makes these visible by *training* the model to emit uncertainty. 
- **For EXP-101**: Zero-hedge traces that are incorrect represent these silent failures
- If EXP-101 finds zero-hedge precision < 96%, the gap likely represents silent failures that need the trained-marker approach rather than passive HVR detection

### 4. Global ≠ Local
Verbalized confidence and reasoning-trace uncertainty are mechanistically different signals. EXP-101 should measure both:
- **HVR** (local): Hedging markers in reasoning trace
- **Explicit confidence** (global): Whether agent expresses explicit confidence statements

## Actionable Recommendations

### HIGH Priority
- **EXP-101 enhancement**: Separate mid-trace hedging from conclusion hedging. The paper predicts these carry different information. Add position-weighted analysis (already noted in EXP-101 design — this paper validates that design choice).
- **Flag for Bob**: Temporal analysis of hedging (Phase 1, Step 4 of EXP-101) is supported by this paper's finding that local signals detect failures *during* generation. This is the highest-value analysis.

### MEDIUM Priority
- **Trained `<uncertain>` markers**: If passive HVR doesn't discriminate well (AUROC < 0.60), consider training/prompting agents to emit explicit uncertainty markers. This paper shows it works.
- **Dual-interface agent architecture**: Global confidence for auto-accept/reject gates + local markers for real-time intervention. Design spec for future optimization.

### LOW Priority
- **Adaptive RAG integration**: Global confidence could drive selective tool-use/retrieval in agent workflows.

## Key Quotes
- "Reasoning-time uncertainty signaling makes previously silent failures visible during generation"
- "Verbal confidence mainly refines how existing uncertainty is decoded, whereas reasoning-time signaling induces a broader late-layer reorganization"

## Connections
- **DD#656 (SELFDOUBT)**: Direct extension — SELFDOUBT passively detects hedging; this paper trains active markers
- **DD#667 (MASC)**: Local uncertainty markers could trigger MASC-style metacognitive correction
- **DD#674 (Hallucination Signal Distillation)**: Both address mid-generation failure detection, different approaches (hidden states vs. verbal markers)
- **H-094**: Validates and extends — HVR works but trained markers work better

---
*Scout DD#679 | Session 389 | 2026-04-09*
