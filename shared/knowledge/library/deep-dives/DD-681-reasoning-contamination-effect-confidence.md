# DD#681: Closing the Confidence-Faithfulness Gap — Reasoning Contamination Effect

**Paper**: "Closing the Confidence-Faithfulness Gap in Large Language Models" (Miao & Ungar, March 2026)
**arXiv**: 2603.25052
**Rating**: ★★★★½ EXCELLENT
**Connection**: H-094 (HVR confidence gating), EXP-101 (HVR validation), DD#656 (SELFDOUBT), DD#679 (Explicit Uncertainty)

## Core Contribution

Mechanistic interpretability analysis showing that **calibration (actual accuracy) and verbalized confidence are encoded linearly but are ORTHOGONAL** in LLM representation space. Critically discovers the **"Reasoning Contamination Effect"** — when models simultaneously reason and verbalize confidence, the reasoning process *disrupts* the confidence direction.

## Key Results

### Orthogonal Encoding
- Linear probes + contrastive activation addition (CAA) steering show:
  - **Calibration direction** (does the model know it's right/wrong?) is linearly encoded
  - **Verbalized confidence direction** (what confidence score does it output?) is also linearly encoded
  - These two directions are **orthogonal** — the model's internal "knowing" and external "saying" are decoupled
- Finding consistent across **three open-weight models** and **four datasets**

### Reasoning Contamination Effect (RCE)
When models are prompted to **simultaneously reason through a problem AND verbalize a confidence score**:
- The reasoning process **disrupts the verbalized confidence direction**
- **Exacerbates miscalibration** — makes confidence scores LESS reliable
- Mechanism: reasoning activations interfere with the confidence computation pathway

### Two-Stage Adaptive Steering
- Pipeline that reads the model's internal accuracy estimate and steers verbalized output to match
- Substantially improves calibration alignment across all evaluated models

## Critical Implications for EXP-101 / H-094

### 1. ⚠️ CRITICAL WARNING: Reasoning Contamination Effect Applies to Agent Traces
Agent reasoning traces are **exactly** the setting where RCE manifests:
- Agents reason extensively (tool use, analysis, debugging) while their hedging markers are embedded in that reasoning
- The RCE predicts that hedging markers *within reasoning* will be **noisier** than hedging markers in standalone confidence assessments
- **For EXP-101**: This is the likely explanation if HVR performs worse on agent data than on SELFDOUBT's clean benchmarks
- **Concrete prediction**: HVR computed from agent traces will have AUROC 0.55-0.65 (lower than SELFDOUBT's benchmark performance) due to RCE

### 2. Orthogonality Means HVR Captures Only One Signal
The model's internal "do I know this?" and external "how confident do I sound?" are **different things**:
- HVR measures the **verbalized** direction (how the model sounds)
- The **calibration** direction (actual reliability) is separate
- EXP-101 may find that hedging correlates with some kinds of errors (where the model knows it's uncertain) but misses **confidently wrong** outputs (where the model doesn't know it's wrong)
- This maps directly to the "silent failure" problem in DD#679

### 3. Position Matters Even More
If reasoning contaminates confidence, then:
- **Early-trace hedging** (during active reasoning) → more contaminated, less reliable signal
- **Late-trace hedging** (after reasoning, near conclusion) → less contaminated, more reliable signal
- **EXP-101 design implication**: Position-weighted HVR (which the EXP-101 design already notes) is not just a nice-to-have — it's *critical* for filtering out reasoning contamination

### 4. Two-Stage Architecture Suggestion
For future agent confidence systems:
1. **Stage 1**: Let the agent reason freely (no confidence elicitation during reasoning)
2. **Stage 2**: After reasoning, separately elicit a confidence assessment
This avoids RCE and gives a cleaner confidence signal

## Actionable Recommendations

### HIGH Priority (for Bob/EXP-101)
- **Prediction to test**: RCE predicts that full-trace HVR will underperform late-trace HVR. In EXP-101 Phase 1, compute HVR for (a) full trace, (b) last 20% of trace, (c) first 20% of trace. Compare AUROCs. If (b) >> (a) > (c), RCE is confirmed on agent data.
- **Separate reasoning from confidence**: The RCE suggests adding a separate "confidence assessment" step after agent reasoning, rather than relying on in-reasoning hedging markers.

### MEDIUM Priority
- **Silent failure detection**: The orthogonality finding means HVR will miss confidently-wrong outputs. These are the most dangerous failures. EXP-101 should explicitly quantify: what fraction of incorrect sessions have zero hedging? (This is the false-negative rate of the HVR gate.)
- **Steering potential**: If we had access to model internals, the two-stage steering approach could substantially improve confidence reporting. Flag for future architecture decisions.

### LOW Priority
- **Multi-model validation**: The orthogonality finding holds across models, suggesting HVR limitations are fundamental, not model-specific.

## Key Quotes
- "Calibration and verbalized confidence signals are encoded linearly but are orthogonal to one another"
- "When models are prompted to simultaneously reason through a problem and verbalize a confidence score, the reasoning process disrupts the verbalized confidence direction, exacerbating miscalibration"
- "We term this the 'Reasoning Contamination Effect'"

## Connections
- **DD#656 (SELFDOUBT)**: This paper explains WHY SELFDOUBT's HVR might work less well in practice than in benchmarks — RCE
- **DD#679 (Explicit Uncertainty)**: Complements — DD#679 shows local markers work differently from global; DD#681 shows reasoning contaminates confidence
- **DD#680 (Linguistic Confidence)**: DD#680's finding that "most LLMs underperform on natural LC" is explained by RCE — reasoning contaminates the hedging signal
- **H-094**: Adds significant nuance — HVR is a real signal but has fundamental limitations from orthogonality and RCE
- **DD#674 (Hallucination Signal Distillation)**: Hidden-state probing avoids RCE entirely (operates below the verbalization layer)

---
*Scout DD#681 | Session 389 | 2026-04-09*
