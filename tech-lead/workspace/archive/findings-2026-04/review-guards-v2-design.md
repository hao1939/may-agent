# Design Review: Guards as Workflow Demands + Cron-to-Workflow Migration

**Reviewer:** Tech-Lead  
**Date:** 2026-04-14  
**Document:** agents/may/workspace/DESIGN-guards-v2.md  
**Verdict:** APPROVE with conditions

---

## Summary

This is a well-structured proposal that unifies two related concerns:
1. Guards become event-driven demand producers within workflows
2. Cron handlers migrate to sensor-judge workflows

Both are sound architectural directions. The demand model is clean, the implementation is well-scoped, and the migration categories are correctly triaged. I have a few concerns on edge cases and one structural recommendation.

---

## What's Good

### 1. Guards as pure functions → demands
The `handle(event) → Demand[]` interface is excellent. Guards today are scattered across `composeGuards()` with ad-hoc interception logic. Making them pure event listeners with typed return values is strictly better:
- Testable in isolation (no mocks needed)
- Composable (multiple guards, no ordering issues for block/warn)
- The demand types (block/warn/run_step) cover the real cases we've seen

### 2. Correct separation of workflow vs non-workflow
"No workflow = no guards" is the right call. Agent sessions without workflows are already unstructured — trying to guard them creates a different (worse) problem. This was validated by the verify-wrap assessment (workspace/verify-wrap-assessment.md) where scout's inline-everything pattern made workflow-level guards impossible.

### 3. Migration categories are correctly triaged
The 5 categories (Sensor→Dead Report, Sensor→Action, DB Sync, Operational Cleanup, Context Prep) are accurate. Keeping infrastructure handlers as JS is right — no LLM judgment needed for watchdog/sync/cleanup. The sensor-judge pattern is the correct abstraction for the others.

### 4. `runFunction()` is a good primitive
Zero-LLM-cost workflow steps have been missing. This enables the sensor-judge pattern without wasting tokens on data collection.

### 5. Implementation phases are correctly ordered
Phase 1 (core demand system) → Phase 2 (guard library) → Phase 3 (heartbeat workflow) → Phase 4 (handler migrations) is the right dependency chain.

---

## Concerns

### C1: Injected step agent choice — why always "bob"?

Both example guards (`auto-test`, `verify-files`) inject steps using `agent: "bob"`. But:
- Bob is the architect/research agent. Running tests is a coder task.
- The calling workflow already has a `ctx.agent` — the injected step should probably use the same agent, or a configurable default.
- Hardcoding agent names in guards creates coupling. Consider: `agent: ctx.agent` or a guard-level config.

**Recommendation:** Guards should not hardcode agent names. Either:
- (a) Use a `defaultAgent` field on the guard, set at registration time
- (b) Pass `ctx.agent` through the event so guards can reference it
- (c) Use a dedicated "verifier" agent role (future)

### C2: `extractChangedFiles()` / `extractWrittenFiles()` — these don't exist

The example guards call `extractChangedFiles(event.result)` and `extractWrittenFiles(event.result)`. But `TaskResult` doesn't have a structured "changed files" field — it has `lastAssistantText` and `messages[]`. Extracting file lists from unstructured LLM output is fragile.

**This is the hardest part of the design.** Guards need structured data about what happened, but today's `TaskResult` doesn't provide it. Options:
- (a) Parse `finish()` deliverables — the `deliverables` array in finish() data has file paths. This is the best structured source.
- (b) Parse tool receipts — tool call results include file paths. Reliable but requires plumbing receipts into TaskResult.
- (c) Regex on lastAssistantText — fragile, don't do this.

**Recommendation:** Document how guards get structured data. The `finish()` deliverables path is the most pragmatic. Consider adding a `deliverables?: {path: string, description: string}[]` field to `TaskResult` or to `CompletedStep`.

### C3: Injection depth limit interaction with guard-on-guard events

The depth limit (`MAX_INJECTION_DEPTH = 3`) plus "guards react to injected step events" creates a subtle interaction:

```
planned step done → guard A returns run_step → depth 1
  injected step done → guard B returns run_step → depth 2  
    injected step done → guard A returns run_step → depth 3 (MAX)
      injected step done → skipped (depth exceeded)
```

This is bounded, which is good. But the `injectionDepth = 0` reset before the next planned step means a misbehaving guard could consume 3 injected steps per planned step. With 5 planned steps, that's 15 extra agent sessions.

**Recommendation:** Add a per-workflow total injection count cap (e.g., `MAX_TOTAL_INJECTIONS = 10`) alongside the depth limit. Log when the cap is hit.

### C4: Heartbeat workflow migration — timing concern

Phase 3 replaces `fireHeartbeat()` with a workflow. But heartbeats are currently the most frequent and most critical operation. The workflow adds:
- `runFunction("gather-context")` — adds structured step overhead
- Guard evaluation at each step boundary
- `WorkflowBlocked` possibility (a guard could accidentally block a heartbeat)

**Recommendation:** Phase 3 should be the LAST migration, not the third. Migrate low-risk handlers first (error-scan, daily-brief) to validate the pattern, then tackle heartbeats. Also: heartbeat workflows should NOT have `block`-type guards — a blocked heartbeat is worse than an unguarded one.

### C5: `runFunction()` and guard events — agree with proposal (c)

Open Question 3 asks whether `runFunction()` steps should emit events and whether `run_step` demands should be processed. The proposal suggests: emit events, process warn/block, skip run_step. This is correct — a pure-JS function's output shouldn't trigger agent sessions. Document this clearly in the interface.

---

## Open Questions — My Answers

### Q1: Guard ordering
**Agree with proposal.** Blocks always win, regardless of registration order. Scan all guards, collect all demands, then process: blocks → halt, else run_steps → execute, then warns → collect. This is what the code already shows in `resolveDemands()`.

### Q2: Injected step failures  
**Agree with option (c).** Let guards decide. The auto-test guard can inspect the test step's result and return a `block` if tests failed. This is more flexible than hardcoding failure=block, and it's already bounded by the depth limit.

### Q3: runFunction() and guards
**Agree with proposal.** Emit events (guards might want to warn/block based on data), but skip `run_step` demands from function-step events.

---

## Structural Recommendation: Phase the `WorkflowContext` additions

Don't add `addGuard()` + `runFunction()` + `warnings` to `WorkflowContext` all at once. Phase it:

**Phase 1a:** Add `runFunction()` to WorkflowContext — this is independently useful and zero-risk.  
**Phase 1b:** Add guard types + `addGuard()` + demand resolution — the core guard system.  
**Phase 1c:** Add `warnings` readonly array — follows naturally from Phase 1b.

This reduces blast radius per merge and lets us validate `runFunction()` independently.

---

## Relationship to Existing Guard System

The current `composeGuards()` chain (10 guards in `compose-guards.ts`) operates at the **tool call level** — they intercept individual tool invocations (bash, write, edit). The new system operates at the **workflow step level** — they intercept completed agent sessions.

These are complementary, not competing:
- Tool-level guards: prevent bad individual actions (cross-edit, secret leak, op budget)
- Workflow-level guards: ensure quality of completed work (run tests, verify files, block bad PRs)

The design correctly notes "no change to `beforeToolCall` hooks." Good — these should coexist.

The Phase 1 guard-as-sensor work (commit 459d1df) and Phase 2 Step 1 (workflowContext wiring into BeforeToolCallContext, req:7ed47fae) are prerequisites — they establish the plumbing that this design builds on.

---

## Verdict

**APPROVE** — proceed with implementation in the phased order described, with these conditions:
1. Resolve C2 (structured data extraction) before building guards that depend on file lists
2. Add per-workflow total injection cap (C3)
3. Move heartbeat migration to Phase 4 (after other handlers validate the pattern) (C4)
4. Don't hardcode agent names in guards (C1)
