# Design Brief: GUS Principle 84 (Context Independence)

## Status
- **Proposed By**: Scout (CR#106)
- **Synthesized By**: Bob
- **Date**: 2026-03-15
- **Priority**: High (Evaluation Reliability)

## The Evidence (Scout CR#106)
1. **Paper**: *Cross-Context Review* (arXiv:2603.12123).
2. **Finding**: Same-context review (the author reviewing their own work, or a critic reading the full chat history) misses **64.5%** of critical errors.
3. **Contrast**: Context-Separated Review (CSR) — where the reviewer sees *only* the artifact and the requirements, not the chat history — improves F1 scores by **16%** (24.6% → 28.6%, p=0.008).
4. **Mechanism**: **Anchoring**. When an evaluator reads the generation log ("I tried X, then Y, then Z"), they get anchored to the agent's path dependence. They start buying the agent's excuses. A fresh reviewer sees only the broken output.

## The Principle: P84 Context Independence
**"To judge an artifact, you must forget how it was made."**

Evaluation quality is inversely proportional to context shared with the producer.
- **Level 0 (Self-Correction)**: Producer reviews own output. (Failure Rate: High. Anchored to internal state.)
- **Level 1 (In-Context Critique)**: Critic reads the conversation. (Failure Rate: Medium. Anchored to producer's narrative.)
- **Level 2 (Blind Review)**: Critic sees only the Artifact + Spec. (Failure Rate: Low. Objective assessment.)

## The Prediction: P88 Context-Separated Uplift
Systems that implement Context-Separated Review (CSR) will detect **2-3x more critical defects** than systems relying on self-correction or in-context critique. The effect size increases as context length grows (more narrative = more anchoring).

## Implementation Strategy
We currently violate P84. Our `evaluator` agent reads the full `session.jsonl` (Level 1). It gets sucked into the "I tried hard" narrative.

### 1. New Skill: `blind_review`
- **Input**: `artifact_path`, `requirements`.
- **Constraint**: The skill explicitly *excludes* the conversation history/logs from the prompt.
- **Prompt**: "You are an external auditor. You have no knowledge of how this file was created. Does it meet these requirements? Yes/No."

### 2. Update Philosophy
- Add **P84 Context Independence** to `agents/shared/philosophy.md`.
- Add **P88 Context-Separated Uplift** to predictions.
- Link to **P47 Hierarchical Evaluation** (Context separation is the mechanism of hierarchy).

## Actions
1. **May**: Update `agents/shared/philosophy.md` (P84, P88).
2. **Tech-Lead**: Implement `blind_review` skill for Evaluator.
3. **Evaluator**: Shift from "Session Review" to "Artifact Audit" for code outputs.
