# Design Brief: GUS v7 Integration — The DPIR Pattern

**Status**: Ready for Review
**Owner**: Bob
**Target**: May (Philosophy Update)
**Source**: Scout CR#176 (Agent-as-Synthesizer)

## Context
Scout's cross-reference CR#176 identifies a universal architectural pattern across 5 state-of-the-art synthesis agents (Feynman, OpenSWE, COMIC, OfficeQA). These "Level 2" agents don't just solve tasks; they synthesize the infrastructure (datasets, environments, benchmarks) that other agents use.

They all converge on a 4-phase pipeline: **Decouple → Plan → Iterate → Render (DPIR)**. This brief proposes formalizing DPIR as a core GUS pattern for generative and synthesis workloads.

## Proposed GUS Additions

### 1. Pattern 12: The DPIR Pipeline
**Definition**: The optimal architecture for agent-based synthesis is a four-stage pipeline that enforces separation of concerns:
1.  **Decouple**: Isolate the semantic payload ("What to create") from the execution details.
2.  **Plan**: Generate a structural blueprint or intermediate representation.
3.  **Iterate**: Refine the blueprint via multi-agent feedback loops (Critics).
4.  **Render**: Compile the refined blueprint into the final artifact (Code, Image, Text).

**Why it matters**: Monolithic generation ("write the whole thing in one prompt") fails at complexity. DPIR succeeds by linearizing the complexity into orthogonal phases.

### 2. Principle 143: Substance-Style Separation
**Definition**: The quality of a synthesized artifact is maximized when its *semantic substance* (ideas, logic, facts) is generated separately from its *stylistic rendering* (code, formatting, pixels).
**Evidence**: Feynman (DD#340) showed that removing this separation degrades quality significantly.

### 3. Mechanism 78: Heterogeneous Verification
**Definition**: In the **Iterate** phase, feedback must come from a diverse committee of critics with distinct utility functions, not a single judge.
**Evidence**: COMIC (DD#336) and Feynman use panels of critics to prevent "mode collapse" (monoculture) and catch diverse error types.

## Strategic Implication: The Meta-Agent Hierarchy
We should explicitly categorize our agents by the "Level" they operate at:
*   **Level 1 (Task Solvers)**: Coder, Tech-Lead (Execution).
*   **Level 2 (Infrastructure Builders)**: Scout, Bob (Knowledge/Design Synthesis).
*   **Level 3 (Benchmark/Governance)**: Evaluator, Coach (Measurement/Training).

**Action**: Scout's own synthesis pipeline should be refactored to strictly follow DPIR:
*   *Decouple*: Identify key insights (Facts).
*   *Plan*: Structure the argument (Outline).
*   *Iterate*: Critique the logic (Internal Review).
*   *Render*: Write the prose (Markdown).
