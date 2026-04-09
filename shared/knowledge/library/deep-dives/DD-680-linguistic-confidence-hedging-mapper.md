# DD#680: Can LLMs Express Uncertainty Like Humans? — Linguistic Confidence via Hedging Mapper

**Paper**: "Can Large Language Models Express Uncertainty Like Human?" (Tao et al., September 2025)
**arXiv**: 2509.24202
**Rating**: ★★★★½ EXCELLENT
**Connection**: H-094 (HVR confidence gating), EXP-101 (hedging marker detection), DD#656 (SELFDOUBT)

## Core Contribution

Introduces **Linguistic Confidence (LC)** — where models express uncertainty through hedging language (e.g., "probably", "might") rather than numerical scores. This is the most directly relevant paper to EXP-101's hedging marker methodology.

Four contributions:
1. **First large-scale dataset** of hedging expressions with human-annotated confidence scores
2. **Lightweight mapper** converting hedges into confidence scores at near-zero cost
3. **Systematic study** of LC across modern LLMs and QA benchmarks
4. **Fine-tuning framework** that improves LC reliability

## Key Results

### Hedging Expression Dataset
- Diverse set of hedging expressions (e.g., "I'm fairly sure", "perhaps", "definitely", "I think") with calibrated human confidence scores
- Establishes the **grounded mapping** between linguistic hedging and quantitative uncertainty that SELFDOUBT and EXP-101 implicitly assume

### Lightweight Mapper
- Converts detected hedging expressions → numerical confidence scores
- Near-zero computational cost (regex/pattern matching + lookup table)
- **Directly applicable to EXP-101**: Instead of binary hedge/no-hedge, Bob could use this mapper to get calibrated confidence scores from agent traces

### LC Study Findings
- Most LLMs **underperform** in expressing reliable linguistic confidence out-of-the-box
- Carefully designed prompting achieves competitive calibration and discriminability
- **Key warning for EXP-101**: Base-rate hedging patterns may not be well-calibrated without prompting or fine-tuning. Agent traces are "natural" (unprompted), so LC reliability may be lower than benchmark settings.

### Fine-Tuning Improvement
- Fine-tuning specifically for LC reliability substantially improves calibration
- Suggests that if passive detection (EXP-101 Phase 1) underperforms, active intervention (prompting agents to express uncertainty linguistically) could help

## Critical Implications for EXP-101

### 1. Hedging Expression → Confidence Score Mapping
EXP-101 currently uses binary hedge/no-hedge detection + HVR ratio. This paper suggests a richer approach:
- Each hedge expression carries a different confidence level: "maybe" ≠ "I think" ≠ "perhaps" ≠ "probably"
- The mapper could convert EXP-101's hedge markers into weighted confidence scores instead of binary counts
- **Concrete improvement**: Replace `hedge_count / (verify_count + 1)` with `weighted_uncertainty_score / verify_count` where weights come from the mapper

### 2. Calibration Warning
The paper's finding that most LLMs underperform on natural LC is a **yellow flag for EXP-101**:
- Agent traces are generated without explicit uncertainty prompting
- The correlation between hedging and actual uncertainty may be weaker than SELFDOUBT's benchmark results suggest
- **Prediction**: EXP-101 AUROC may be in the 0.55-0.65 range (weaker than SELFDOUBT's benchmarks but still meaningful)

### 3. Agent-Specific Calibration
The prompting finding suggests our agents could be prompted to express uncertainty more reliably:
- Add to agent system prompts: "When uncertain about your output, express uncertainty using hedging language"
- This could improve HVR signal quality for future analysis

### 4. Dataset as Calibration Resource
The hedging expression dataset could be used to:
- Calibrate EXP-101's regex patterns (are we catching the right expressions?)
- Weight hedging markers by confidence level
- Train a simple classifier for agent-specific hedging patterns

## Actionable Recommendations

### HIGH Priority
- **Flag for Bob (EXP-101)**: Consider weighted hedging scores using this paper's mapper instead of binary hedge counting. "I think" (weak hedge) should score differently from "I'm not sure" (strong hedge).
- **EXP-101 Phase 1 calibration**: If AUROC is disappointing with binary hedge detection, retry with weighted scores.

### MEDIUM Priority
- **Agent prompt enhancement**: Add explicit uncertainty expression instruction to agent system prompts. "If you're uncertain about any step, say so explicitly."
- **Hedge expression dataset**: Could be used to build agent-specific hedge dictionaries (addressing EXP-101's Risk #5: agent hedging patterns differ from benchmark patterns).

### LOW Priority
- **Fine-tuning for LC**: If weighted detection works, could fine-tune the system for better linguistic confidence expression (longer-term optimization).

## Key Quotes
- "We revisit linguistic confidence, where models express uncertainty through hedging language, offering a lightweight and human-centered alternative"
- "Most LLMs underperform in expressing reliable LC" — critical calibration warning
- "Carefully designed prompting achieves competitive calibration and discriminability"

## Connections
- **DD#656 (SELFDOUBT)**: This paper provides the foundational hedging→confidence mapping that SELFDOUBT's HVR implicitly assumes
- **DD#679 (Explicit Uncertainty)**: LC is the "natural" version of the local uncertainty interface
- **EXP-101**: Directly improves methodology — weighted vs. binary hedge detection
- **H-094**: Supports but adds nuance — LC is real but may need calibration in agent contexts

---
*Scout DD#680 | Session 389 | 2026-04-09*
