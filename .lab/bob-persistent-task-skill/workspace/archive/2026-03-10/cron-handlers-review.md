# Design Review: Agent-Owned Cron Handlers

**Status:** Approved with recommendations ✅
**Reviewer:** Bob (Design Philosopher)
**Target:** `docs/agent-cron-handlers-design.md`

## Summary
The proposal to move cron handlers from infrastructure (`run/handlers/`) to agent domains (`agents/<name>/handlers/`) is **strongly aligned** with our design philosophy. It reinforces the "Agent as Feature Unit" principle and creates a clean path for offloading routine tasks from LLM to code.

## 1. Interface Analysis

### HandlerContext
**Verdict:** Sufficient for current needs.
The context provides the essential "agent harness" (`manager`, `persistDir`, `emit`).
- **Recommendation:** Ensure `ctx.emit` supports a `level` parameter (info/debug/error) or provide a separate `ctx.log` for non-user-facing diagnostics. Handlers often need to log technical details that shouldn't clutter the user's stream.

### Factory Pattern (`create`)
**Verdict:** Clean and standard.
- The `create(ctx, entry)` closure pattern is robust.
- It allows state isolation per-handler while sharing the harness context.
- It enables configuration injection (Option A) elegantly.

## 2. Option A vs B (drain-todo)
**Recommendation:** **Go with Option A (Config-driven).**
- **Alignment:** Matches *Simplest Thing That Works (P1)*.
- **Reasoning:** The logic for "drain a queue" is identical regardless of which queue it is. Duplicating the file (`agents/may/handlers/bob-drain.ts`) violates DRY without adding semantic value.
- **Mechanism:** The `entry.handlerConfig` field is the correct place to specify the target agent.

## 3. Fallback Behavior
**Verdict:** Excellent / Anti-Fragile.
- **Mechanism:** "Missing handler file → Fall back to LLM task"
- **Alignment:** *Crash Recovery (P10)* and *Resilience*.
- **Benefit:** This allows "progressive hardening". A task can start as an LLM prompt (in `cron.json` message), then be "upgraded" to a JS handler file without changing the cron schedule structure. If the JS file is deleted/moved, it degrades gracefully back to the LLM (assuming the `message` field remains).

## 4. Risks & Edge Cases
- **Security:** Dynamic import of filenames from JSON (`import(handlerPath)`) is a potential vector for directory traversal if `cron.json` is untrusted.
  - **Fix:** Sanitize handler names to alphanumeric characters only before importing.
- **Code Duplication:** If multiple agents need the same "system status" logic, they currently can't share it without duplicating the file or importing from a common internal lib.
  - **Acceptable:** For now, `agents/may` effectively owns the system-wide maintenance. This is acceptable per *Scope Discipline (P7)*—May is the supervisor.

## 5. Philosophy Alignment

### ✅ Aligned
- **Agent as Feature Unit (P15):** This is the biggest win. An agent's directory now contains its *entire* operational logic (prompts + code handlers). You can move/archive an agent by moving one folder.
- **Heartbeat vs Cron: Explore Then Offload (P33):** This design creates the concrete "landing pad" for offloading. It makes the transition from "LLM does it" to "Code does it" structural and standardized.
- **Agents Do Cognitive Work, Not Chores (P40):** Explicitly supports moving mechanical chores (draining queues) out of the cognitive loop.
- **Offload Routing to Infra (P17):** The `cron.json` + Handler architecture moves scheduling logic entirely out of the prompt.

### ⚠️ Watch Out
- **Hidden Dependencies:** Ensure `agents/may/handlers/` doesn't secretly depend on `run/` internals that aren't exposed in `HandlerContext`. Keep the boundary clean.

## Final Recommendation
Proceed with implementation. This refactor is a necessary maturity step for **Phase 2 (Hardening)**.
