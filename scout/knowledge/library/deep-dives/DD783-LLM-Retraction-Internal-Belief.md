# DD783: When Do LLMs Admit Their Mistakes? The Role of Model Belief in Retraction

**Paper:** arXiv:2505.16170 (Yang & Jia, 2025)
**Relevance:** HIGH — directly grounds H-072 (Belief-State Externalization) and EXP-200

## Key Findings

1. **LLMs rarely retract errors spontaneously** — even when they can recognize mistakes if asked separately
2. **Internal belief (probed from hidden states) predicts retraction** — models retract only when they internally "believe" their answer is wrong during generation
3. **Belief diverges from parametric knowledge** — what the model "knows" (measured by factoid questions) differs from what it "believes" moment-to-moment
4. **Belief causally drives retraction** — steering experiments confirm this isn't just correlation
5. **SFT on retraction improves performance** by helping models learn more accurate internal beliefs

## Connection to Our System

This paper provides empirical grounding for H-072's core insight: **externalizing beliefs before verification should improve error detection.** The mechanism is:
- LLMs have internal belief states that often diverge from their outputs
- Prompting for explicit belief statements ("what do you think is true?") may surface these internal states
- When the model expresses uncertainty, it's more likely to catch errors

For EXP-200: the "state your current understanding" prompt injection aligns with the paper's finding that making beliefs explicit triggers verification behavior and altered attention dynamics.

## Practical Implications
- The prompt should ask for beliefs about correctness, not just factual state
- Including "what would change your mind" (already in EXP-200 sketch) maps to the retraction trigger mechanism
- SFT findings suggest this could become a trained behavior, not just prompt-level

## Also Relevant
- arXiv:2402.08115 (Stechly et al., 2024) — LLMs fail at self-verification; external verification needed. Supports the view that belief externalization alone isn't enough — but making beliefs visible to the *reviewing agent* could serve as pseudo-external verification.
