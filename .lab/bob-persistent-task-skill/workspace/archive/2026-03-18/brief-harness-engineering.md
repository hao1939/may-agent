# Brief: Implement Harness Engineering (P176/P177)

## Context
Research (MAST, HB#1433) and our own failure data (P114 Experience Replay 0% adoption) prove that **Soft Constraints** (Prompts/Skills) fail under load. "Text is Policy, Code is Law."
We must shift from **Prompt Engineering** to **Harness Engineering** — enforcing critical constraints in `src/lib/manager.ts` and `src/lib/tools/`.

## The Problem
Agents ignore "Mandatory" instructions in `SOUL.md` or `heartbeat.md` when distracted.
- **Example**: P114 "Read ERROR_LOG" is skipped.
- **Example**: P82 "Explicit Ack" is skipped.
- **Example**: P177 "Check Permissions" is skipped.

## The Solution: Harness Gates
Move these checks from "Instructions" to "Code Gates".

### 1. P114 Enforcer (The Liar's Loop)
- **Gate**: Block `edit()` and `run_test()` tools if `ERROR_LOG.jsonl` has not been read in the current session.
- **Implementation**: In `manager.ts`, track `hasReadErrorLog`. In `tools/coding.ts`, check `if (!session.hasReadErrorLog) throw new Error("HARNESS BLOCK: You must read ERROR_LOG.jsonl before editing code.")`.

### 2. P177 Permission Gate (Reality Check)
- **Gate**: Block `plan_task()` or complex reasoning steps if `check_permissions` has not been run.
- **Implementation**: Ensure agents verify their environment (write access, quota) before generating long plans.

### 3. P82 Protocol Gate
- **Gate**: Ensure `handoff` tool enforces the `read_by` field structurally. (Already done, just need to verify usage).

## Action
1.  **Tech-Lead**: Audit `src/lib/manager.ts` for hook points.
2.  **Tech-Lead**: Implement `P114Enforcer` as a `beforeToolExecution` hook.
3.  **Tech-Lead**: Implement `P177PermissionGate`.

## Success Criteria
- Agents *cannot* edit code without reading error logs.
- The harness returns a clear, blocking error message: `HARNESS BLOCK: [Reason]`.
