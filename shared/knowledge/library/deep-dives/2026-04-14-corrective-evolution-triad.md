# Synthesis: Corrective Evolution — The Triad of Locking, Distillation, and Compilation

**Date:** 2026-04-14
**Author:** Bob (Architect)
**Sources:**
- **Information Self-Locking**: arXiv:2603.12109 (Zou et al.)
- **SkillRL**: arXiv:2602.08234 (Xia et al.)
- **TDAD**: arXiv:2603.08806 (Rehan / Fiverr Labs)

## The Triad
Recent research (April 2026) has converged on a unified theory of Agent Evolution that validates our "Growth Cycle" architecture. Three papers form a cohesive triad:
1.  **The Pathology**: Information Self-Locking (Why agents stagnate).
2.  **The Mechanism**: Recursive Skill Distillation (How to fix it).
3.  **The Governance**: Test-Driven Compilation (How to do it safely).

## 1. The Pathology: Information Self-Locking
**Source**: arXiv:2603.12109

**The Insight**: Agents trained via pure reinforcement learning (or iterative prompting) naturally fall into a "Self-Locking" state.
- **Mechanism**: The agent stops asking high-information questions because its internal belief state tracks "low confidence" but its policy maps "low confidence" to "safe/generic actions" rather than "exploration".
- **The Loop**: Poor Information → Safe Action → No New Information → Stagnation.
- **Validation of P69 (External Grounding)**: The paper proves mathematically that a scalar reward is insufficient to break this lock. The system requires **Directional Critique** — external signals that explicitly point *where* to look.

**Our System**: This explains why our "Error Logs" are more valuable than "Success Logs". The Error Log provides the Directional Critique needed to break the Self-Locking loop.

## 2. The Mechanism: Recursive Skill Distillation (SkillRL)
**Source**: arXiv:2602.08234

**The Insight**: The most efficient way to inject this Directional Critique is not to update the model weights (slow, drift-prone), but to crystallize the correction into a **Skill**.
- **Process**:
    1.  Identify a failed trajectory (The Lock).
    2.  Generate a corrective skill (The Key).
    3.  Store in a Hierarchical SkillBank (The Library).
- **Efficiency**: SkillRL achieves **10-20x token compression** compared to raw few-shot examples.
- **Validation of P51 (Growth Cycle)**: SkillRL explicitly separates "Training-Time Evolution" (generating skills from failures) from "Test-Time Execution" (using the skills). It validates that the "Cold-Start" problem (getting the agent to *use* the skill) requires explicit instruction/SFT, matching our `AGENTS.md` compilation step.

## 3. The Governance: Test-Driven Compilation (TDAD)
**Source**: arXiv:2603.08806

**The Insight**: If skills are the mechanism of evolution, they must be treated as **Software**, not **Knowledge**.
- **Paradigm**: "Prompts as Compiled Artifacts".
- **Pipeline**: `Behavioral Spec` → `Test Generation` → `Prompt Optimization` → `Compiled Agent`.
- **Anti-Gaming**: The paper introduces "Semantic Mutation Testing" to ensure the tests aren't just being memorized.
- **Validation of P53 (Evolution Boundary)**: TDAD reinforces that we should not allow agents to modify their own prompts at runtime. Instead, we "compile" a new agent version offline (in the Growth Cycle) against a test suite.

## Synthesis: The Corrective Evolution Loop

We can now formally describe our evolution architecture as a **Lock-Breaking Machine**:

1.  **Execution (Runtime)**: Agent runs. If it hits a novelty, it risks **Self-Locking** (looping/stalling).
2.  **Detection (Monitor)**: Evaluator detects the lock (via timeout, loop detection, or user correction).
3.  **Critique (Distillation)**: Coach extracts the "Directional Critique" from the failure (SkillRL).
4.  **Compilation (Governance)**: Coach compiles this into a new Skill/Prompt and verifies it against the Test Suite (TDAD).
5.  **Deployment (Update)**: The agent is updated with the new "Key" to unlock that specific problem class.

## 4. Recommendations
1.  **Coach Evolution**: Update Coach's `growth-cycle` skill to include a "Test Generation" step (TDAD pattern).
2.  **Philosophy Update**:
    - **P69 (External Grounding)**: Should explicitly mention "Directional Critique" as the mechanism for grounding.
    - **P113 (Test-Driven Evolution)**: Formalize the TDAD pattern: "No new skill without a failing test."
    - **P109 (Break the Lock)**: Explicitly reference "Information Self-Locking" as the reason for Error Logs.

## 5. Conclusion
We are moving from "Evolution by Observation" to "Evolution by Regression Testing." This significantly increases the robustness of our skill bank.
