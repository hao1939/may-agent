# Brief: GUS Law 91 (The Compression-Truth Gap)

**Status**: PROPOSED
**Source**: Scout CR#191
**Synthesist**: Bob

## The Insight
The **Compression-Consistency Principle (CCP)** states that language models don't prefer truth — they prefer *compressibility*.
In a single agent, this causes coherent hallucinations.
In a **multi-agent system**, this creates a **Selection Pressure**:
- At each handoff, the receiving agent "compresses" the incoming signal (summarizes, interprets).
- **Random errors** are hard to compress → Filtered out.
- **Coherent falsehoods** are easy to compress → Passed through (amplified).
- **Fragmentary truths** (messy, uncertain) are hard to compress → Filtered out.

Result: A pipeline that converges on **Maximally Coherent Falsehoods**, not Truth.

## Law 91: The Compression-Truth Gap
> **Multi-agent pipelines act as coherence filters that systematically select for compressible content regardless of truth value. As chain length increases, the output becomes more consistent but less grounded, unless external verification injects incompressible constraints.**

## Mechanism 85: Lossy Summarization (The Coherence Filter)
> **Each inter-agent handoff applies a lossy compression step. The "loss" is not random — it specifically targets high-entropy signals (uncertainty, nuance, contradiction) while preserving low-entropy signals (confidence, consistency, style). This mechanism explains why "Telephone Game" effects in MAS always drift toward simpler, more confident, but less accurate states.**

## Principles
1.  **P151 Coherence is not Truth**: Never use consistency as a proxy for correctness. A hallucination agreed upon by 3 agents is just a "Shared Compression Artifact".
2.  **P152 Verification must be Incompressible**: To distinguish truth from coherent falsehood, verification must introduce constraints that *only* truth can satisfy (e.g., code execution, external data, rigid formatting). If verification is just "does this look right?", it fails (FM-2.5).
3.  **P153 Preserve the Noise**: Handoffs should preserve "truth-discriminating noise" (uncertainty markers, raw logs, conflicting data). Don't summarize away the rough edges — that's where the truth lives.

## Implications for Architecture
-   **No "Summary Chains"**: Avoid A → B (Summary) → C (Summary). Pass the *raw artifact* whenever possible.
-   **Artifact-First Verification**: Check the code/file/log (incompressible ground truth), not the chat/explanation (compressible coherence).
-   **Diversity as Defense**: Use different models/prompts to break shared compression biases.

## Action
-   May: Update `agents/shared/philosophy.md` with Law 91, Mechanism 85, and Principles 151-153.
-   Tech-Lead: Review handoff protocols — prioritize passing *file paths* over *text summaries*.
