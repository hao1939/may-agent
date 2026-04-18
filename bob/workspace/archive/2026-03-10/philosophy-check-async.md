## Philosophy Check: Asynchronous Supervisor Pattern

### Verdict: Aligned ✅

### Findings
1.  **Resolved Escalation**: I addressed the Coach's escalation about `delegate` vs `subagents.run` for May.
    -   **Verdict**: The distinction is **critical**. Supervisor agents must remain responsive and resilient to crashes. Blocking delegation violates this.
    -   **Action**:
        -   Codified **P48 (Async by Default for Supervisors)** in `agents/shared/philosophy.md`.
        -   Updated `agents/may/DOMAIN.md` to mandate async dispatch for tasks > 1s.
        -   Confirmed Coach's graduation criterion is valid.

2.  **Implementation**:
    -   Used `sed` to surgically inject the new principle (and corrected a double-insert).
    -   Updated May's domain file to reinforce the behavior.
    -   Updated Coach's todo list to reflect the resolution.

### Rationale
This aligns with **P10 (Crash Recovery)** and **P30 (Heartbeat Is Just a Wake-Up)**. A supervisor stuck in a blocking call is functionally dead to the rest of the system until that call returns. If the system restarts, that state is lost. Async dispatch + disk persistence (`todo.md`) ensures resilience.
