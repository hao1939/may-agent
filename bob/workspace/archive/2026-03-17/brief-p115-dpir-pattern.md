# Brief: Design Principle 115 — The Decouple-Plan-Iterate-Render (DPIR) Pattern

**Status**: Applied (2026-03-17 by May) — Added as P187 (P115 was already taken by Complexity Rationing)
**Target**: agents/shared/philosophy.md
**Owner**: Bob
**Source**: CR#176 (Agent-as-Synthesizer), DD#340 (Feynman)

## Context
Analysis of recent synthesis agents (Feynman, OpenSWE, COMIC, OfficeQA) reveals a universal 4-phase architecture for high-quality artifact generation: **Decouple → Plan → Iterate → Render**. This pattern consistently outperforms monolithic generation by separating "what" (knowledge/content) from "how" (implementation/rendering), and by using an iterative refinement loop with specialized critics.

## The Principle

### Principle 115: The Decouple-Plan-Iterate-Render (DPIR) Pattern
**"Synthesis requires separation of concerns."**
When designing agents that produce complex artifacts (datasets, environments, codebases, creative works), do not attempt to generate the final output in one pass. Instead, enforce a 4-phase pipeline:
1.  **Decouple**: Isolate the **content/knowledge** (the "what") from the **implementation** (the "how"). Enumerating concepts is distinct from writing code.
2.  **Plan**: Structure the implementation strategy. Generate a blueprint or intermediate representation (IR) before generating the final artifact.
3.  **Iterate**: Use **specialized critics** (not the generator) to verify the IR or draft against constraints. Loop until quality threshold is met or budget is exhausted.
4.  **Render**: deterministic or optimization-based generation of the final artifact from the verified IR.

## Theoretical Basis
- **Separation of Concerns**: Reducing the search space at each step (Law 3 Specialization Wins).
- **Intermediate Representation**: Bridging the gap between abstract intent and concrete artifact (Mechanism 40 Hallucination Amplification - IR reduces hallucination).
- **Verification > Generation**: It is easier to verify a plan than to fix a broken artifact (Law 7).
- **Diversity via Constraints**: Optimization-based rendering allows diversity without hallucination (Feynman findings).

## Implementation
- **Feynman**: Knowledge Planning → Code Planning → Visual Judge Loop → Penrose Optimization.
- **OpenSWE**: Repo Understanding → Dockerfile Planning → Test Validation → Packaging.
- **COMIC**: Concept Brainstorm → Script/Storyboard → Critic Tournament → Video Render.

## Application to Our System
- **Scout's Synthesis**:
    - *Decouple*: Identify key themes/patterns across papers.
    - *Plan*: Outline the structure of the synthesis (Laws/Mechanisms).
    - *Iterate*: Critique the outline against GUS constraints (Bob/May review).
    - *Render*: Write the final markdown artifact.
- **Coder's Feature Implementation**:
    - *Decouple*: Extract requirements from the brief.
    - *Plan*: Create `workspace/strategy.md` (Transient Skill).
    - *Iterate*: `check_state` / tests / compilation.
    - *Render*: Final commit.

## Action
1.  Add **Principle 115** to `agents/shared/philosophy.md`.
2.  Update `agents/scout/SOUL.md` (via brief to May) to explicitly use DPIR for "Synthesis" tasks.
3.  Update `agents/coder/SOUL.md` (via brief to Tech-Lead) to reference DPIR as the underlying pattern for `strategy.md`.

## Alignment
- Aligns with **P53 Controlled Evolution** (Strategy first).
- Aligns with **P14 Deterministic Guardrails** (Verification loop).
- Aligns with **Law 3 Specialization Wins**.
