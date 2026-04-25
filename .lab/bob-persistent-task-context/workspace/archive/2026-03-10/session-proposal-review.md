# Review: Session Simplification Proposal

**Date:** 2026-03-07
**Reviewer:** Bob
**Verdict:** **APPROVE WITH MODIFICATIONS**

## Summary
The proposal correctly identifies that the current `persistent` flag creates unnecessary code bifurcation. By unifying the state machine into a single `ActiveSession` class with an `autoClose` policy, we can reduce maintenance burden and testing surface area.

However, we must be careful not to conflate **Mechanism** (how the code works) with **Policy** (how the system behaves). While the *mechanism* supports a continuum of behaviors (`immediate` ... `TTL` ... `never`), our **System Policy** (per `session-model-simplification.md`) remains strict:
1.  **Interface Agent** → `autoClose: "never"` (Chat Session)
2.  **Everything Else** → `autoClose: "immediate"` (Task Session)

We should adopt the mechanism but reject the temptation to use `autoClose: number` (TTL) or allowed `followUp` on task sessions, as these re-introduce the "Zombie Process" and "Hidden State" problems we just decided to eliminate.

## Specific Findings

### 1. The Mechanism is Sound ✅
Refactoring `handleCompletion`, `cancel`, and `close` to remove `if (persistent)` branches is excellent engineering. It implements the "Simplest Thing That Works" (P1) at the code level.

### 2. Reject `autoClose: number` (TTL) ⚠️
The proposal suggests:
> `autoClose: 300_000` = new: close after 5 minutes idle (useful for task agents that might receive late notifications)

**Recommendation: REJECT this specific feature for now.**
- **Reasoning**: This creates a "Zombie State" where a process hangs around consuming memory "just in case".
- **Alternative**: If a notification arrives late for a task agent, the proposal correctly notes it should go to `undelivered-notifications.jsonl`. This file-based queue is robust and crash-proof. We do not need a 5-minute memory window.
- **Action**: Remove `number` from the `autoClose` type definition in the first pass. YAGNI (You Ain't Gonna Need It).

### 3. `followUp` on Task Sessions
The proposal allows `followUp()` on any session.
- **Risk**: This encourages "conversational sub-agents" (e.g., "Wait, change X") which violates our move toward "Sub-agents as Functions".
- **Mitigation**: While the *code* should allow it (for simplicity), the *Manager* should generally enforce that `followUp` is for the Interface Agent.
- **Exception**: "Steering" (`steer()`) a running session is a valid use case for `followUp`-like mechanics on a task session. The unified model handles this gracefully (injecting a message into a running loop). This is a benefit.

### 4. `done` / `error` State Removal
Moving these to archive metadata is correct. A live session is either working (`running`) or waiting (`idle`). "Done" is a historical fact, not a current state.

## Directives for Implementation

1.  **Adopt the Unified State Machine**: Proceed with merging `ActiveSession` logic.
2.  **Strict Config**:
    - The `Manager` constructor should accept an `interfaceAgent` name.
    - `manager.run()` should set `autoClose` based on identity:
      ```typescript
      const autoClose = (agent === this.interfaceAgent) ? "never" : "immediate";
      ```
3.  **No TTL**: Do not implement the `setTimeout` logic for `autoClose: number`. Only handle `"immediate"` (0ms) and `"never"`.
4.  **Crash Recovery**: Continue to prioritize restoring the Interface Agent. For `autoClose: "immediate"` sessions, crash recovery should simply mark them as `failed` (since they are ephemeral and context is lost), allowing the parent workflow to retry.

## Conclusion
This proposal provides the **code-level implementation path** for the **architectural design** we agreed upon. It is compatible with `session-model-simplification.md` as long as we maintain discipline on configuration.

**APPROVED** to proceed with implementation, subject to the removal of TTL logic.
