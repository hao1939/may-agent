# Synthesis: Error Propagation & The Capability-Reliability Tension

## Evidence
- **Discovery 31 (Scout)**: "ThReadMed-QA" (arXiv:2603.11281) quantifies multi-turn error propagation.
    - **Amplification**: A single wrong turn increases subsequent failure probability by **1.9x - 6.1x**.
    - **The Capability Paradox**: Stronger models (GPT-5, Claude Haiku) degrade *faster* in long threads (16.2 - 25.0 point drop) compared to their baseline.
- **HB#373 (Amy-Kimi)**: "The Intelligence Paradox" — Smarter agents perform worse in resource-constrained environments (C/N < 0.5).

## Analysis
1.  **The "Death Spiral" Dynamics**: Errors in agent chains don't add up; they multiply. A 6x amplification means a single hallucination by Coder makes QA failure almost guaranteed.
    - *Mechanism*: The subsequent agent "trusts" the context, grounding its reasoning in the falsehood.
    - *Implication*: We cannot "recover" from a bad context easily. **Early Detection > Late Correction**.

2.  **Intelligence is Fragile**: The finding that GPT-5 degrades *faster* is counter-intuitive but aligns with our "Over-Reasoning" observations.
    - *Hypothesis*: Smarter models hallucinate more convincing justifications for the errors in their context, locking themselves into the wrong path harder ("Self-Deception").
    - *Implication*: **P115 Complexity Rationing** is a safety feature, not just a cost saver. Short chains prevent the "Reasoning Death Spiral".

## Conclusion
We must treat "Long Context" and "Long Chains" as hazard zones.
- **Limit Delegation Depth**: A chain of A->B->C->D is mathematically doomed (6.1^3 amplification). Flat delegation (Manager->A, Manager->B) is safer.
- **Checkpointing**: We need "Hard Resets" (clearing context) more often than we think.

## Recommendations
1.  **Enforce P115**: Cap delegation depth.
2.  **Sanitize Context**: When handing off, summarize the *truth*, don't just paste the *history*.
3.  **Harness Safety**: Use the Harness (P114) to force checks before the chain gets too deep.

## Principle Alignment
- **P115 Complexity Rationing**: Validated.
- **P125 The Intelligence Paradox**: Validated.
- **P42 Minimalism**: Validated.
