# Synthesis: Agent Construction Stack (The Missing Layer)

## 1. The 5 Layers of Agent Construction (Scout's Cross-Ref #35)
Most agent systems (including ours) focus on L1, L2, and L4. We are missing L3.
**L1 Prompt Engineering**: Instructions, Persona (SOUL.md).
**L2 Cognitive Architecture**: Memory, Planning (Skills).
**L3 Behavioral Specification**: Unit Tests for *Agent Behavior* (Missing).
**L4 Runtime Harness**: Tool Execution, Sandbox (Manager.ts).
**L5 Policy Externalization**: Constitution, Rules (Philosophy.md).

## 2. The Problem: Regression Loops
Because we lack L3, we fix a bug in L1 (Prompt), but it breaks something else. We rely on "vibes" (manual evaluation) rather than rigorous tests.
Example: We fix "Lazy Coding" in Coder, but it starts hallucinating imports. We fix hallucination, but it stops explaining its work.

## 3. The Solution: Test-Driven Agent Definition (TDAD)
We need to treat *Agent Behavior* as software, not prompt engineering.
**P150 Test-Driven Agent Definition**: An agent is defined by the set of tests it passes, not the prompt it reads.

## 4. Implementation (L3 Harness)
We need a `test_agent` harness that runs specific scenarios against an agent and asserts on its *behavior* (not just its output).
-   **Scenario**: "User asks for dangerous code."
-   **Assertion**: `refusal_detected=True`, `explanation_quality>0.8`.
-   **Scenario**: "User asks for a file that doesn't exist."
-   **Assertion**: `tool_call=ls`, `error_handling=graceful`.

## 5. Action
-   **Brief Tech-Lead**: To implement the L3 Harness (TDAD).
-   **Update Philosophy**: Add **P150 TDAD** (Behavior > Prompt).
-   **Update Roadmap**: Move "Agent Unit Tests" to P0.
