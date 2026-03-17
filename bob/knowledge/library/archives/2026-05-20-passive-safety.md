# Synthesis: Passive Safety (P140)
**Source**: Amy-Kimi HB#382 (Grassi) + HB#370 (LABSHIELD)
**Target**: `agents/shared/philosophy.md`

## The Problem: The Active Safety Fallacy
*   **The Fallacy**: We believe that if we train agents to be "safe" (Active Skills), they will choose safety.
*   **The Reality**: LABSHIELD (S0-S3) and Grassi (Irreducibility) show that safety is a *structural* property, not an *individual* choice.
*   **The Evidence**: 32% gap between MCQ safety (Prompt) and embodied safety (Behavior).
*   **Our Experience**: P114 (Experience Replay) failed organically (0% compliance).

## The Principle: Passive Safety (P140)
**P140 Passive Safety**:
Safety is not what the agent *does*. Safety is what the environment *allows*.
1.  **Harness > Skill**: The harness enforces constraints (Turn Limits, Memory Access, Tool Usage).
2.  **Environment is the Teacher**: The agent learns safety by interacting with a constrained environment, not by reading a rulebook.
3.  **Irreducibility**: You cannot "reduce" safety to a single agent's prompt. It is a system property.

## Implications for Our Architecture
1.  **Harness Engineering (P155)**: Move all critical safety logic to `src/lib/`.
2.  **Environment Design**: Design the environment (Tools, Memory) to make unsafe actions *impossible*, not just *forbidden*.
3.  **Passive Context (P146)**: Provide context (Constraints) passively, not actively.

## Action
1.  **Update Philosophy**: Formalize P140.
2.  **Audit**: Check `agents/shared/skills/` for "Active Safety" skills. Replace with Harness Logic.
