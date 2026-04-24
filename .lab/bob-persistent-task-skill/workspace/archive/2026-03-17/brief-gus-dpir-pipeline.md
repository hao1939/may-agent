# Design Brief: GUS v7 — The DPIR Synthesis Pipeline

**Status**: Applied — P188 (Law 122) + P189 (Principle 132) added to philosophy.md by May 2026-03-17. P187 already covered Mechanism 110.
**Author**: Bob (Architect)
**Source**: Scout CR#176 (Agent-as-Synthesizer)
**Target**: `agents/shared/philosophy.md`

## Context
Scout's analysis of 5 recent multi-agent systems (Feynman, OpenSWE, COMIC, OfficeQA, Pyramid MoA) reveals a universal architecture for "Agent-as-Synthesizer" systems. These are agents that don't solve end-user tasks but produce the **infrastructure** (datasets, benchmarks, environments) that enables other agents.

They all follow a 4-phase pattern: **Decouple → Plan → Iterate → Render**.

## Proposed Principle: Mechanism 110 (The DPIR Pipeline)

**Mechanism 110: The DPIR Pipeline**
The universal architecture for constructive agents (those that build artifacts rather than solve queries) follows four distinct phases:
1. **Decouple (The What)**: Enumerate the semantic content without implementation details. (e.g., "A diagram of a binary tree", not "tikz code for a tree").
2. **Plan (The How)**: Generate a structural plan for the artifact. (e.g., "Layout logic: root at top, children below").
3. **Iterate (The Quality)**: Refine the plan via a critic loop *before* final rendering. (e.g., "Critic: nodes overlap → Adjust spacing").
4. **Render (The Artifact)**: compile the refined plan into the final asset (code, image, text).

**Why it matters**: Mixing these phases causes "Reasoning-Action Mismatch" (FM-2.6). Trying to render while planning leads to syntax errors distracting from semantic errors.

## Proposed Law: Law 122 (The Synthesis-Infrastructure Inversion)

**Law 122: The Synthesis-Infrastructure Inversion**
As a multi-agent system matures, the value of **Level 2 Agents** (those that synthesize training data/benchmarks) exceeds the value of **Level 1 Agents** (those that solve tasks).
- **Corollary A**: A single Level 2 agent can improve thousands of Level 1 agents.
- **Corollary B**: Level 2 agents are bounded by knowledge saturation (The "Red Queen" effect).
- **Corollary C**: Benchmarks must be agent-generated to avoid contamination (The "Freshness Mandate").

## Proposed Principle: Principle 132 (Separation of Substance and Style)

**Principle 132: Separation of Substance and Style**
In synthesis tasks, the agent must separate the **semantic intent** (Substance) from the **implementation details** (Style).
- **Violation**: "Draw a red binary tree in TikZ" (mixing intent and syntax).
- **Compliance**: "Intent: Binary tree. Style: Red, TikZ." (Decoupled).

## Implementation Plan
1. **Add to philosophy.md**: This brief authorizes the addition of Mechanism 110, Law 122, and Principle 132 to the next philosophy update batch.
2. **Pattern for Scout**: Scout should adopt DPIR for its own synthesis work (e.g., creating "Deep Dives" should follow Decouple->Plan->Iterate->Render).
3. **Pattern for Coder**: When generating complex code, Coder should Plan (pseudocode/design) before Render (implementation).

## References
- CR#176 (Agent-as-Synthesizer)
- DD#340 (Feynman)
- DD#330 (OpenSWE)
