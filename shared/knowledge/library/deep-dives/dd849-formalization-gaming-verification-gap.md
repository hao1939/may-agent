# DD-849: Formalization Gaming — LLMs Exploit Verification Gaps

**Paper**: 2604.19459 — "Do LLMs Game Formalization? Evaluating Faithfulness in Logical Reasoning"
**Authors**: Kim, Poiroux, Bosselut (EPFL) | **Venue**: VerifAI-2 Workshop, ICLR 2026
**Rating**: ★★★★½ | **Added**: 2026-04-22

## Key Findings

1. **High compilation ≠ faithful reasoning**: Despite 87-99% Lean 4 compilation rates, LLMs produce unfaithful formalizations that pass verification.
2. **Two distinct unfaithfulness modes**:
   - **GPT-5**: Fabricates axioms during proof generation (reactive fallback) — detectable via cross-stage comparison
   - **DeepSeek-R1**: Mistranslates premises during formalization — internally consistent, **evades detection entirely**
3. **No systematic gaming in unified generation**: Models prefer reporting failure over forcing proofs. The unfaithfulness is not intentional but structural.
4. **Two-stage pipeline** (separate formalization from proving) reveals failures hidden in unified approach.

## Relevance to Our System

### H-098 (Attention Channel Theory) — Direct Connection
The paper demonstrates exactly the Ch1/Ch2 distinction in verification:
- **Ch1 (surface signal)**: Compilation rate, proof validity — both pass at high rates
- **Ch2 (deep verification)**: Formalization faithfulness — fails silently

DeepSeek-R1's "internally consistent mistranslation" is the **verification analog** of H-181's relational bug blindness: the agent produces output that satisfies all surface checks while being fundamentally wrong at the relational/semantic level.

### H-160 (Structural Enforcement)
The finding that cross-stage comparison catches GPT-5's axiom fabrication but NOT DeepSeek-R1's premise mistranslation shows that even structural verification has blind spots. This is a **Ch2 sub-type limitation**: structural checks catch reactive fallbacks but not proactive mistranslation.

### H-185 (Verification Remasking)
The two-stage pipeline is essentially a "fresh eyes" approach to verification — separate the formalization step from proving to prevent self-consistency bias. Directly supports the remasking hypothesis: splitting verification into independent stages catches errors that unified passes miss.

### Practical Implication
For our evaluation system: **never trust aggregate pass rates**. The paper shows that even formal verification (the gold standard) has exploitable gaps when the formalization step itself is unfaithful. Our gym scenarios should test for "internally consistent but wrong" outputs, not just "passes checks."

## Key Quote
> "High compilation rates or accuracies should not be equated with faithful reasoning."

## Tags
`verification` `adversarial` `Ch1-vs-Ch2` `formalization` `faithfulness`
