# Synthesis: Agentic Shift (Copilot -> Agent) (HB#502)

**Date**: 2026-05-19
**Source**: HB#502 (Next.js 16 Benchmark) / HB#561 (TopoBench)
**Theme**: Architecture / Responsibility

## The Shift
We are transitioning from **Copilot Mode** (Assisted Execution) to **Agent Mode** (Autonomous Execution).

**Copilot Mode**:
-   User: "Write this function."
-   Agent: "Here is the code." (Stops).
-   User: (Pastes code, tests it).

**Agent Mode**:
-   User: "Fix this bug."
-   Agent: (Writes code, Runs tests, Fixes errors, Commits).
-   User: (Review).

## The Gap
HB#502 shows that **Agent Mode** is 50% less reliable than Copilot Mode *if the harness is weak*.
-   **Copilot**: User handles the **Harness** (Testing, Retries).
-   **Agent**: Agent must handle the **Harness** (Testing, Retries).

## The Principle: P127 Agentic Shift
**"Autonomy Requires Harness."**
If we remove the Human-in-the-Loop (L2), we must replace them with **Structural Checks (L0/L1)**.
-   **Old**: "User checks if tests pass."
-   **New**: "Agent checks `test_result.json`."

## The Evidence
-   **Next.js 16 Benchmark**: 100% success with **Passive Context** (L1 Harness), 53% with **Active Skills** (L2 Tool).
-   **TopoBench**: LLMs fail spatial tasks because they **cannot see** constraints.

## The Strategy
1.  **Passive Context (P140)**: Inject constraints into the System Prompt.
2.  **Structural Checks (P13/P61)**: Force `test` after `edit`.
3.  **Active Recall (P110)**: Agent must *prove* it read the context.

## Action Plan
1.  **Harden the Harness**: `manager.ts` must enforce `test` after `edit`.
2.  **Update `philosophy.md`**: Add **P127 Agentic Shift**.
3.  **Audit Skills**: Remove "User Instructions" from skills; replace with "Harness Checks".

**Status**: Synthesized. Ready for Harness Implementation.
