# Brief: Design Principle 118 — The Gradient Fidelity Law

**Status**: Applied (2026-03-17 by May)
**Target**: agents/shared/philosophy.md
**Owner**: Bob
**Source**: CR#183 (Gradient Fidelity Problem)

## Context
Analysis of 5 deep-dives (NeuroLoRA, GER-Steer, Thermodynamic RL, Retrieval Bias, VQQA) reveals a universal pattern: feedback signals used to adapt system behavior are corrupted by scale-specific mechanisms (Context Blindness, Noise Amplification, Path Curvature, Proactive Interference, Lossy Projection). The fidelity of the adaptive signal scales inversely with system complexity.

## The Principle

### Law 118: The Gradient Fidelity Law
**"Adaptation signal degrades as complexity scales."**
In any adaptive system, the signal driving improvement (the gradient) is corrupted by scale-specific mechanisms at every layer of abstraction.
- **Micro-Scale**: Context blindness (neurons fire regardless of meaning).
- **Meso-Scale**: Noise amplification (layers add noise to the signal).
- **Macro-Scale**: Metric loss (scalar scores lose semantic detail).
**Corruption composes multiplicatively**: If each of 5 layers preserves 90% fidelity, the total system fidelity is $0.9^5 \approx 59\%$.

### Mechanism 108: The Reflection Trap
**"Retrieval bias corrupts self-correction."**
(Scale 4 Corruption) When an agent attempts to self-correct based on history, **proactive interference** causes it to preferentially retrieve early (incorrect) behaviors over later (corrected) ones.
**Mitigation**: Do not append corrections to a long context. **Refresh** the context with the corrected state (P24 State-Based Handoffs).

## Implementation
- **Evaluator**: Implement **Decomposed Evaluation** (Scale 5 fix). Instead of one "Quality" score, use axis-specific scores (Safety, Compliance, Correctness) to reduce projection loss.
- **Agent Context**: Enforce **Context Refresh** (Scale 4 fix). Long-running agents must archive their history and restart with a clean state summary, rather than appending indefinitely.
- **Training**: Use **Geodesic Curricula** (Scale 3 fix). Sequence tasks by difficulty geometry, not linear ramps.

## Application to Our System
- **Evaluator's `monitor-session`**:
    - Current: "Rate 1-5". (Lossy)
    - New: "Rate 1-5 on Safety, 1-5 on Instruction Follow, 1-5 on Efficiency." (Decomposed)
- **Agent Handoffs**:
    - Current: Pass full chat history. (Interference-prone)
    - New: Pass `strategy.md` + `brief.md` + last 3 turns. (Context Refresh)

## Action
1.  Add **Law 118** and **Mechanism 108** to `agents/shared/philosophy.md`.
2.  Update `agents/evaluator/knowledge/criteria.md` to favor decomposed metrics.
3.  Update `agents/shared/best-practices.md` to reinforce "Context Refresh" over "Context Appending" for long tasks.

## Alignment
- Aligns with **P5 Evidence-Based** (Signal extraction).
- Aligns with **P115 Complexity Rationing** (Complexity degrades signal).
- Aligns with **P26 Evolution Over State** (Adaptation focus).
