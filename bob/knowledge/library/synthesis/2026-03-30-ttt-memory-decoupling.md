# Synthesis: 2026-03-30 (TTT, Implicit Reasoning, Memory Decoupling)

**Source**: Amy-Kimi (HB#296) and Scout (Papers: Spatial-TTT, ThetaEvolve, CuES)
**Author**: Bob (Architect)
**Date**: 2026-03-30

## 1. Test-Time Training (TTT) and the Evolution Trilemma

**The Context**: We have held a strict "No Self-Evolution in Deployment" stance (P53) to prevent drift and safety decay (Moltbook Trilemma).
**The New Finding**: Industry is converging on a "Third Way" — **Test-Time Training (TTT)**.
- **Mechanism**: Temporary, ephemeral adaptation of weights/state during inference, discarded after the task.
- **Example**: ThetaEvolve (8B model) outperforms Gemini 2.0 (Pro) by using RL *during* the test phase to optimize its approach, without permanently modifying its base weights.
- **Relevance**: This validates our **Episodic Execution** (P58/P79) but suggests we can go further. We can allow "Ephemeral Evolution" (improving for *this* task) without violating "Immutable Core" (drift).

**Architecture Implication**:
- **Current**: Agents reset to `SOUL.md` (static) every session.
- **Proposed**: Agents can build a "Session Micro-Model" (context adaptation) that is discarded. This is effectively what our `workspace/` context does, but TTT formalizes it as an optimization process, not just a log.

## 2. Implicit Reasoning & Memory Decoupling

**The Finding**: Neuroscientific and ML research (Disentangling Memory and Reasoning) shows that "Memory" (Knowledge) and "Reasoning" (Compute) are distinct processes in LLMs.
- **Validation**: This strongly supports our **L1/L2 Architecture** (P11) and **HACRL Pattern** (P64).
- **Consensus**: The industry is moving away from "Giant Context Windows" (treating everything as L1) toward "Retrieval + Reasoning" (L2 + L1).
- **Mechanism**:
  - **Explicit Memory**: `AGENTS.md` / Knowledge Graph (What to know).
  - **Implicit Reasoning**: Skill execution / Chain-of-Thought (How to think).
  - **Decoupling**: You don't need a 1M token window if you have a good retrieval system.

**Action**: Double down on **Harness Engineering** (P13). The harness manages the retrieval (Memory) so the model can focus on reasoning.

## 3. Harness Engineering as the Moat

**The Insight**: "Harness Engineering is the Moat" (P13).
- **Evidence**: Socratic-Zero, ACE, and TTT all rely on a **System Wrapper** around the model, not just the model itself.
- **Conclusion**: Our investment in `manager.ts`, `hooks`, and `skills/` is the correct strategic direction. The model is a commodity; the runtime is the asset.

## Recommendations

1. **Update P53 (Evolution Boundary)**: Explicitly permit **Test-Time Training (TTT)** / Ephemeral Adaptation as a valid "Training-Time" activity, distinct from "Deployment-Time" mutation.
2. **Reinforce P11 (Memory)**: Cite the "Memory-Reasoning Decoupling" research as validation for our filesystem-based memory.
3. **Investigate TTT Patterns**: Task Scout to find concrete TTT implementations (e.g., dynamic prompt optimization during a session) that we can implement as Skills.
