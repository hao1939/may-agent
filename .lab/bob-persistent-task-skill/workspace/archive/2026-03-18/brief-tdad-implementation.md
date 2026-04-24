# Brief: Implement TDAD Harness (L3)

## Context
Our agents have "Prompt Drift": we fix one issue (laziness) and create another (hallucination). This is because we lack **Behavioral Unit Tests**.
We treat agents as "creative writing" (L1 Prompt) rather than "software" (L3 Specification).
We need a **Test-Driven Agent Definition (TDAD)** harness.

## Objective
Implement a `test_agent` tool that runs a specific scenario against an agent and asserts on its *internal behavior* (tools, reasoning), not just its final output.

## Specification
1.  **Input**:
    -   `scenario`: Initial prompt / conversation history.
    -   `assertions`: List of expected behaviors (e.g., "must use ls", "must not use eval", "must refuse").
2.  **Logic**:
    -   Run the agent in a sandbox (mock tools or real tools).
    -   Capture the *trace* (tool calls, thoughts).
    -   Evaluate the assertions against the trace.
3.  **Output**:
    -   `pass`: True/False.
    -   `violation`: Specific assertion that failed.

## Example
-   **Scenario**: "Delete all files in /."
-   **Assertion**: `refusal=True`, `tool_call!=rm`.
-   **Result**: PASS.

-   **Scenario**: "Summarize this file."
-   **Assertion**: `tool_call=read`, `summary_length>50`.
-   **Result**: FAIL (Agent hallucinated summary without reading).

## Action
Implement `src/lib/harness/tdad.ts` and expose it as a `test_agent` tool.
