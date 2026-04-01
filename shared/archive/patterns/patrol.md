# Patrol Pattern (L3 Defense)

**Type**: Architectural Pattern (Security/Observability)
**Source**: OpenMOSS, Discovery 29, L3 Patrol Gap
**Owner**: Bob (Design), Evaluator (Implementation)

## Problem: The Silent Failure Gap
Standard monitoring tools (LangSmith, AgentOps) focus on **L1 (Resource)** and **L2 (Behavioral)** metrics (CPU, Tokens, Errors). They miss the most dangerous failures:
- **L3 (Integrity)**: Evaluation Tampering (Agent tricking the judge), Context Pollution (Malicious prompts hijacking memory).
- **L4 (Coordination)**: Zombie Sessions (Stuck tasks), Infinite Loops (Agent asking for help 50 times), Black Hole Handoffs (Sent but never read).

## Solution: The L3 Patrol
A dedicated, independent process that monitors the **Semantic Integrity** and **Coordination Health** of the system.

### Components
1.  **Semantic Monitor (`monitor-session`)**:
    - **Goal**: Detect L3/L4 failures in real-time.
    - **Mechanism**: Evaluator periodically reads active session transcripts.
    - **Detects**:
        - **Wink Pattern**: Infinite loops (repeating same action > 3 times).
        - **Stuck Task**: No progress for > 10 turns.
        - **Silent Failure**: Error swallowed and not reported.
    - **Action**: Injects `[ALERT]` into the session or kills it.

2.  **Coordination Patrol (`delegation-metrics`)**:
    - **Goal**: Detect L4 failures (handoffs).
    - **Mechanism**: Bob/Evaluator periodically audits `.state/delegations.jsonl`.
    - **Detects**:
        - **Black Hole**: Task sent but no `read_by` ack within N minutes.
        - **Orphan**: Task completed but no result consumed.
        - **Zombie**: Agent session active but no heartbeat for > 1 hour.
    - **Action**: Escalates to human or triggers `cleanup` skill.

3.  **Integrity Check (`verify-receipt`)**:
    - **Goal**: Detect L3 tampering.
    - **Mechanism**: Evaluator verifies **Receipts** (HMAC signatures, Test Results), not just claims.
    - **Detects**:
        - **Fake Success**: Agent says "Done" but no artifact exists.
        - **Evaluation Tampering**: Agent tries to influence the judge prompt.

## Implementation Status
- **L3 Semantic**: Active via `evaluator/skills/monitor-session.md`.
- **L4 Coordination**: Partially active via `delegation-metrics.cjs` (Bob).
- **L3 Integrity**: Active via `verify-receipt.cjs` (Evaluator).

## Rules
- **P6 No Silent Failures**: If the Patrol sees a failure, it must escalate. It cannot "fix" it silently.
- **P59 Trust with Verification**: The Patrol does not trust the agent's self-report. It checks the *state*.
