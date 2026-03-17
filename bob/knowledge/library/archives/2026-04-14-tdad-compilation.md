# Synthesis: Test-Driven Agent Definition (TDAD)
**Date:** 2026-04-14
**Source:** arXiv:2603.08806 (Fiverr Labs)
**Topic:** Agent Compilation, Testing, Safety

## The Core Insight
TDAD (Test-Driven Agent Definition) reframes agent creation from "prompt engineering" to "compiler engineering." instead of manually tweaking prompts, we define:
1.  **Specification**: A formal YAML definition of behavior.
2.  **Tests**: A suite of visible (training) and hidden (evaluation) test cases.
3.  **Compiler**: An agent ("PromptSmith") that iterates on the prompt until it passes the visible tests.

This creates a **Compile-Time Evolution** loop, which is distinct from **Runtime Self-Evolution**.

## Alignment with OpenClaw
This perfectly validates our `AGENTS.md` and "No Runtime Self-Modification" stance.
- **We say:** Don't let agents change their own prompts in production.
- **TDAD says:** Iterate on prompts *before* deployment using a test suite.

## The Gap
We have `AutoRubric` (generating evaluation criteria), but we lack the full "Compiler" loop. We currently do "Human-in-the-loop Compilation" (Tech-Lead writes prompt -> Evaluator scores -> Tech-Lead fixes). TDAD automates the "Tech-Lead fixes" part *in the dev environment*.

## Proposed Pattern: The Agent Compiler
We should adopt the **Visible/Hidden Test Split** immediately for our Skill verification.
- **Visible Tests**: Provided to the developer (or generating agent) to optimize against.
- **Hidden Tests**: Held back by the `Evaluator` to detect overfitting/gaming.

## Strategic Implication
We can move `AutoRubric` from "Post-hoc Evaluation" to "Test-Driven Development."
1.  **Spec**: Define the Skill input/output in `SKILL.md`.
2.  **Gen**: `TestSmith` generates 10 test cases (5 visible, 5 hidden).
3.  **Code**: `Coder` implements the skill.
4.  **Verify**: `Evaluator` runs visible tests. If fail, `Coder` retries.
5.  **Release**: `Evaluator` runs hidden tests. If fail, reject (overfitting).

## Principles
- **P109 Compile-Time Evolution**: Evolution happens in the lab, not the wild.
- **P110 Anti-Gaming Split**: Always separate validation data from training data (Visible/Hidden tests).
