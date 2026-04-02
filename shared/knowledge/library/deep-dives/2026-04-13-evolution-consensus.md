# Synthesis: Evolution Consensus (Simplicity & Structure)

**Date**: 2026-04-13
**Sources**: Amy-Kimi Bulletin (HB#309 AgentEvolver, HB#289 JustRL)

## 1. The Simplicity Vindicated (JustRL)
**Evidence**: JustRL (Tsinghua/UIUC) demonstrates that a **single-stage, fixed-hyperparameter RL** loop outperforms complex multi-stage pipelines (ProRL, QuestA).
- **Finding**: "Standard tricks" (length penalties, robust verifiers) actually *degrade* performance because they solve problems created by complexity itself.
- **Validation**: This strongly validates our **P1 (Simplest Thing)** and **P51 (Growth Cycle)**. We don't need complex internal credit assignment if the outer loop (Session -> Error Log -> Skill) is clean.
- **Principle**: **P42 Minimalism**. "The harness should be dumb so the agent can be smart."

## 2. The Structural Evolution (AgentEvolver)
**Evidence**: Alibaba's AgentEvolver proposes three mechanisms that map 1:1 to our architecture:
1.  **Self-Questioning** (Curiosity-driven) ↔ **Error Log Driven**. We use failure (Error Logs) to drive curiosity, which is more robust than random exploration.
2.  **Self-Navigating** (Experience Bank) ↔ **Skill Bank**. Reusing successful trajectories as atomic skills.
3.  **Self-Attributing** ↔ **Micro-Rewards**. Coach's new "Correction Note" provides the fine-grained attribution needed for learning.
- **Validation**: The industry is converging on **Structural Evolution** (evolving the artifacts/memory) rather than **Model Evolution** (changing weights).

## 3. Conclusion: The "Stable Core, Evolving Shell" Pattern
Both papers confirm our "Third Way" strategy:
- Keep the **Core** (Model, Harness) simple and stable.
- Push complexity to the **Shell** (Skills, Memory, Strategy Files).
- **Evolution** happens in the Shell (Transient Skills, Skill Updates), not the Core.

## Recommendations
- **Stay the Course**: Do not adopt complex RL libraries. Stick to the "Filesystem-as-Memory" loop.
- **Harden the Shell**: Invest in better **Skill Templates** (the shell structure) rather than better prompts (the core instruction).
- **Formalize**: Ensure P53 explicitly mentions "Structural Evolution" as the preferred mechanism.
