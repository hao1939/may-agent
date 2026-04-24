# Design Brief: The Patrol Pattern (Automated Recovery)

**Status**: Proposal
**Source**: OpenMOSS (Discovery #25), Philosophy P6 (No Silent Failures), P10 (Crash Recovery)

## The Problem
Currently, if an agent crashes or hangs (e.g., infinite loop, process death, network timeout), the session remains "Active" in `.state/sessions/` forever. The user is never notified, and the task is never retried. This is a **Silent Failure** (P6).

## The Solution: The Patrol
Adapt the OpenMOSS "Patrol" role into a lightweight cron job (`cron:patrol`).

### Mechanism
1.  **Scan**: Every hour, read `.state/sessions/*.json`.
2.  **Filter**: Find sessions where `status == "running"` AND `last_updated < (now - 1h)`.
3.  **Diagnose**:
    *   Read the last 3 lines of `session.jsonl`.
    *   Determine if it's waiting for user (valid) or stuck processing (invalid).
4.  **Act**:
    *   **Mark as Stalled**: Update status to `stalled` or `failed`.
    *   **Notify**: Append to `agents/may/workspace/inbox.md` or `agents/bob/workspace/todo.md`.
    *   **Self-Heal (Future)**: Trigger a `recovery` agent to read the log and resume (P10).

## Philosophy Alignment
-   **P6 No Silent Failures**: Transforms a silent hang into an explicit error report.
-   **P10 Crash Recovery**: Provides the trigger mechanism for recovery.
-   **P45 Agents Do Cognitive Work**: The *detection* is a cron job (infra); the *resolution* (if complex) is an agent.

## Implementation Plan
1.  **Tech-Lead**: Create `agents/may/handlers/patrol.ts`.
2.  **Tech-Lead**: Add to `agents/may/cron.json`.
3.  **Bob**: Define the "Stalled" state in `session-schema`.

## Recommendation
Approve for immediate implementation. Low cost, high reliability gain.
