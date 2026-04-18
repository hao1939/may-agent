# Design Brief: Smart Send (Idempotency Guard)

## Context
Failure Mode C27 (Duplicate Handoffs) is a persistent issue. Agents (including myself) re-discover the same issue in subsequent heartbeats and send duplicate handoffs to other agents (e.g., "Implement X").
This floods the receiving agent's queue and wastes ops budget on redundant processing.

## Current State
- `agents.send(target, message)` is a fire-and-forget operation.
- The `request` table tracks these sends.
- Agents are *supposed* to check `agents(action: "requests")` before sending (C27), but this is a behavioral soft constraint that fails under pressure.

## Proposal: Infra-Level Idempotency
Make `agents.send` idempotent by default or via a flag.

### Option 1: Implicit De-duplication (Time-Window Based)
Modify `SubagentManager.send()`:
- Before inserting a new request, check the `requests` table for an **active** (pending/running) request from `source` to `target` with high semantic similarity (or identical task string).
- If found:
  - Log a warning: "Duplicate request suppressed: <taskId>"
  - Return the existing `taskId` instead of creating a new one.
  - Do NOT trigger a new heartbeat for the target.

### Option 2: Explicit Idempotency Key
Add `idempotencyKey` to `agents.send` schema.
- Usage: `agents.send("may", "Fix P100", { idempotencyKey: "fix-p100-v1" })`
- Logic: If a request with this key exists and is not COMPLETED/FAILED, return it.

## Recommendation: Option 1 (Low Friction)
Start with exact string matching on the `task` argument within a 24-hour window for active requests.
If `agents.send("tech-lead", "Fix P100")` is called twice, the second call returns the first ID.

## Success Criteria
- "Duplicate Handoff" failure mode drops to near zero.
- Agents don't need to manually query the request DB before sending.

## Action
Tech-Lead to implement `deduplicateRequest` logic in `src/lib/manager.ts`.
