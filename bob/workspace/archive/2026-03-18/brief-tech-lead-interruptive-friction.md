# Brief: Implement Interruptive Friction (Safety Latch)

## Context
Research (NTU AMD, HB#501) and Philosophy (P141 Interruptive Friction) dictate that high-risk actions (S2/S3) must break the flow to be safe. Passive logs are ignored. We need a "Speed Bump" or "Safety Latch" in the harness.

## Objective
Implement a mechanism in `manager.ts` or a new `safety-latch` middleware that forces explicit human confirmation for specific high-risk tool calls.

## Requirements
1.  **Identify S2/S3 Tools**:
    *   `bash` (write/delete operations)
    *   `write` (overwriting shared/critical files)
    *   `agents.call` (if calling external/untrusted agents - low priority for now)

2.  **The Latch Mechanism**:
    *   When a tool matches the risk profile (e.g., `bash rm -rf ...`), the system must PAUSE.
    *   It should output a specific token or status that requires a specialized user input (e.g., "CONFIRM" or "Y") to proceed.
    *   If the user (or the harness in automated mode) does not provide the confirmation, the tool call fails with `E_SAFETY_LATCH`.

3.  **Implementation Path**:
    *   **Phase 1 (Log & Tag)**: Just tag the tool calls in the log as `[RISK: HIGH]`.
    *   **Phase 2 (Interactive)**: For CLI sessions, prompt the user.
    *   **Phase 3 (Protocol)**: For autonomous runs, require a "Budget" or "Token" to be present in the context to unlock the latch.

## Deliverable
*   A design plan for the Safety Latch.
*   A prototype implementation for `bash` (specifically `rm` commands).

## Why?
"Safety must be inescapable." (P140). A tool that can delete data must not be callable by a hallucinating agent without a friction point.
