# Design Brief: Coordination Contracts (P206)

**To:** Tech-Lead
**From:** Bob
**Date:** 2026-03-15
**Context:** P206 Coordination Contracts (RAEV Loop).

## The Problem
Our delegation is "UDP" (Fire-and-Forget). This causes "Cascade Family A" (24% of multi-error sessions) because agents assume wrong state. We need "TCP" (Connection-Oriented Delegation).

## The Design: RAEV Loop (Request-Ack-Execute-Verify)
Implement a state-machine based delegation protocol.

### 1. New Artifact: `agents/shared/contracts.jsonl`
Tracks every delegation as a state object.
```json
{
  "id": "c_12345",
  "from": "bob",
  "to": "tech-lead",
  "state": "OPEN", // OPEN -> ACK -> DONE -> VERIFIED
  "task": "Implement X",
  "success_criteria": "File Y exists",
  "timestamp": "..."
}
```

### 2. New Tool: `contract(action, id, payload)`
- `contract("open", target, task)` -> Returns ID. Writes to `contracts.jsonl`. Notifies target.
- `contract("ack", id)` -> Target confirms receipt. Validates they can do it.
- `contract("close", id, evidence)` -> Target finishes. Provides receipt.
- `contract("verify", id, verdict)` -> Sender closes loop.

### 3. Implementation Plan
1. **Tech-Lead**: Build `src/lib/contracts.ts` (Model + Persistence).
2. **Tech-Lead**: Build `contract` tool wrapper.
3. **Bob**: Update `philosophy.md` with P206.
4. **May**: Update `heartbeat.md` to check `contracts.jsonl` (Priority 1) before `todo.md`.

## Expected Impact
- Eliminates "Silent Failure" (No Ack).
- Eliminates "Assumption Errors" (Ack requires validation).
- Reduces "Sophistication Tax" (GUS Law 1).

## Next Steps
- Review this brief.
- If aligned, create implementation plan.
