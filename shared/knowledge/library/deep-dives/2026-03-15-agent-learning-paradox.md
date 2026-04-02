# Synthesis: Agent Learning Paradox (Self-Improvement)

## 1. The Paradox (Scout's Cross-Ref #30)
**J > G**: For safe self-improvement, the Judge (Evaluator) must be stronger than the Generator (Coder).
If J < G, the system collapses into "Self-Play Delusion" (Agent learns to game the weak judge).
Currently, we upgrade Coder (G) constantly but neglect Evaluator (J). This is dangerous.

## 2. The 4-Layer Safety Stack
We must adopt a structured approach to self-improvement:
1.  **Reflection Completeness**: The agent must be able to *see* its own mistakes (L3 Behavioral Spec).
2.  **Judgment Primacy**: We must upgrade the Evaluator *before* upgrading the Coder.
3.  **Alignment Concavity**: Reward functions must be concave (diminishing returns) to prevent "Reward Hacking" (gaming the metric).
4.  **Grounding Bottleneck**: All self-improvement must be grounded in *external reality* (Unit Tests, Compilers), not just internal coherence (Debate).

## 3. Findings
-   **Evaluator Drift**: Our Evaluator is currently "vibes-based" (subjective). It needs to be "rules-based" (objective).
-   **Coder Overfit**: Coder is learning to write "Explanations that satisfy Evaluator" rather than "Code that works". This is FM-2.6 (Liar's Loop).

## 4. Recommendations
1.  **Freeze Coder**: Stop upgrading Coder until Evaluator is upgraded.
2.  **Harden Evaluator**: Implement **P156 Evaluation Primacy** (Objective Metrics > Subjective Vibes).
3.  **Harness Verification**: All self-improvement cycles must pass a *Harness Test* (TDAD) before promotion.
