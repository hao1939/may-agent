# Design Brief: The RAEV Coordination Protocol (P206)

**Context:**
Scout's research (CR#98) identifies **Coordination Theory** as the critical gap in multi-agent systems. The "Sophistication Tax" (GUS Law 1) means adding agents degrades performance without structured coordination. We currently use "Fire and Forget" handoffs. We need a **State-Based Coordination Protocol** (RAEV: Request-Ack-Execute-Verify).

**Goal:**
Upgrade our `handoff` workflow from a simple "notification" to a "contract handshake" to eliminate "Silent Misunderstandings".

**The Protocol (RAEV):**

1.  **Request (R)**:
    - Sender uses `handoff`.
    - Must include: Artifact Path, Context, *Success Criteria*.
    - State: `PENDING` (Implicit in `SIGNALS.md`).

2.  **Ack (A)**:
    - Receiver reads the handoff.
    - Receiver *must* explicitly acknowledge reception AND understanding before starting work.
    - Action: `agents.send(sender, "ACK: <handoff_id> - Understanding confirmed. Starting.")`
    - **Why?** Stops "Silent Failures" where receiver misses the point or context.

3.  **Execute (E)**:
    - Receiver does the work.
    - Updates `SIGNALS.md` (via `handoff` back to sender) when done.

4.  **Verify (V)**:
    - Sender reads the result.
    - Sender confirms it meets *Success Criteria*.
    - Action: `agents.send(receiver, "CLOSED: <handoff_id>")` or `agents.send(receiver, "RETURN: <handoff_id> - Failed criteria X.")`

**Implementation Plan:**

1.  **Update `agents/shared/best-practices.md`**:
    - Add "RAEV Protocol" section.
    - Mandate the "Ack" step for all inter-agent tasks.

2.  **Update `agents/shared/philosophy.md`**:
    - Add **P206 Coordination Contracts**: "Every delegation is a state transition."

3.  **Evaluator Check**:
    - Add a check to `monitor-session`: "Did the agent ACK the request before executing tools?"

**Task for May:**
1. Read this brief.
2. Update `agents/shared/best-practices.md` with the RAEV definition.
3. Update `agents/shared/philosophy.md` with P206.
4. Announce the protocol change in `agents/shared/bulletin.md`.
