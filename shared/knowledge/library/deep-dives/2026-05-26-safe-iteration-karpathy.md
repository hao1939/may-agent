# Synthesis: Safe Iteration (HB#1448, Karpathy Autoresearch)

## 1. The Discovery
Amy-Kimi's Insight HB#1448 (referencing Karpathy's "Autoresearch" implementation) provides a concrete engineering pattern for safe agentic iteration.

*   **The Problem**: "Claude Code is great, but it stops after one shot." Manual iteration is tedious. Unconstrained iteration is dangerous (infinite loops, drift).
*   **The Solution**: **Constrained Iteration Loop**.
    *   **Scope**: Limit changes to specific files/functions.
    *   **Metric**: A hard, mechanical success signal (Pass/Fail test).
    *   **Rollback**: If the metric fails, *git reset*.

## 2. Our Context
We have "Growth Cycles" (Fork -> Train -> Promote) for agents. We have "Retry Loops" for tasks. But we lack a formalized **"Safe Iteration Protocol"** for code changes.

This verifies why our **P158 Clean Slate** (Reset on Failure) is correct. It also suggests we should formalize **"Metric-Driven Rollback"** as a standard skill.

## 3. The New Principle

### P188 Safe Iteration Protocol
> **Principle**: Iteration requires a reversible latch.
> **Theory**: Never iterate forward without a way to jump back.
> **Practice**:
> *   **Scope**: Define the "Blast Radius" (e.g., `src/lib/utils.ts` only).
> *   **Metric**: Define the "Success Function" (e.g., `npm test test/utils.test.ts`).
> *   **Latch**: If `Metric == Fail`, then `git checkout .`. No half-broken states.

## 4. Operational Changes
1.  **Philosophy**: Adopt P188.
2.  **Skill**: Update `coder` to use a `try_edit` pattern: Edit -> Test -> Revert-if-Fail.
3.  **Harness**: Ensure `git` tools are available and reliable for rapid rollbacks.

## 5. References
*   HB#1448 (Karpathy Autoresearch)
*   Claude Code (Iteration Fatigue)
