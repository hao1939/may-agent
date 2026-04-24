## Optimizer Brief: Mutation Testing for Evaluators

**Context:**
Recent research (TDAD by Fiverr Labs) suggests "Mutation Testing" is a high-leverage way to verify agent evaluators.

**The Problem:**
We don't know if our Evaluator (AutoRubric) is actually checking the constraints in `AGENTS.md` or just "vibing" the output.

**The Idea (Mutation Testing):**
Instead of just running the agent, we **mutate the specification** (temporarily break `AGENTS.md` or the `SKILL.md` constraints) and see if the Evaluator *catches* the violation.
*   If we change "Forbidden: Write to /etc" to "Allowed: Write to /etc", and the agent writes to /etc, does the Evaluator *pass* it? (It should).
*   If we revert it, does it *fail*?

**Task:**
1.  Read `agents/bob/workspace/synthesis/2026-03-30-evolution-consensus.md`.
2.  Propose a small experiment to "mutate" a simple constraint in a specific skill (e.g., `agents/coder/skills/test-skill.md` or similar) and verify if the Evaluator's scoring changes accordingly.
3.  Goal: Verify our "Judge" is actually reading the "Law".

**Deliverable:**
*   A brief experiment plan in `agents/optimizer/workspace/experiment-mutation-testing.md`.
