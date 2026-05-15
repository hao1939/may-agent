# Design Review: Guards as Workflow Demands + Cron-to-Workflow Migration

**Reviewer:** Optimizer  
**Date:** 2026-04-14  
**Document:** `agents/may/workspace/DESIGN-guards-v2.md`  
**Verdict:** **Approve with Required Changes** — architecture is sound, but three issues must be resolved before implementation.

---

## Executive Summary

This is the right architecture at the right time. Workflow adoption is at 70.1% and climbing. The demand model composes well, `runFunction()` fills a genuine gap, and the cron simplification is overdue. The design correctly identifies that guards only make sense inside workflows (User Requirement #1), which avoids the trap of trying to retrofit guards onto freeform sessions.

However, three areas need attention before implementation: (1) the heartbeat migration is far more complex than presented, (2) `runFunction()` step events need clearer semantics, and (3) the `extractChangedFiles()` dependency is hand-waved.

---

## Part 1: Demand Model — Architecture Review

### What works well

**Event-listener model is the right abstraction.** Guards as pure functions (event → demands) is a clean separation. The current `onEvent` callback in workflow-tool.ts (lines 178, 273, 291, 319, 330) already emits the exact events the design subscribes to. This isn't a new event bus — it's a second subscriber on an existing channel. Low-risk integration.

**Demand types are correctly minimal.** Three types (`block`, `warn`, `run_step`) cover every real guard behavior we've needed:
- `block` = the no-secret-leak style hard stop
- `warn` = advisory context for next step (replaces passing notes between steps manually)
- `run_step` = the verify-wrap pattern generalized (inject a step)

**Guards as pure functions enables testing.** You can unit test a guard by passing it a synthetic event and checking the returned demands. No mocking agents or workflows needed. This is a big improvement over testing workflow behavior end-to-end.

### Concern: Guard interface lacks access to workflow context

The `WorkflowGuard.handle()` receives only a `WorkflowGuardEvent`. But realistic guards need more:

- **What agent is running?** The auto-test guard hardcodes `agent: "bob"` in the example (Part 5). In practice, the injected step should use `ctx.agent` — but the guard doesn't have `ctx`.
- **What workflow is this?** A guard might behave differently in `verify-wrap` vs `implement-and-review`.
- **What's the full task?** The `step_done` event includes `task` (the workflow-level task), which helps, but some guards might need the step-level task.

**Recommendation:** Add `agent: string` and `workflow: string` to all events. These are cheap to include and prevent guards from hardcoding agent names:

```typescript
type WorkflowGuardEvent =
  | { type: "step_done"; step: string; result: TaskResult; completedSteps: CompletedStep[]; task: string; agent: string; workflow: string }
  // ... same for other events
```

### Concern: No guard deduplication across registration sources

The design has three registration sources (Part 3): agent.json, workflow code, and future dynamic. If agent.json specifies `["auto-test"]` and the workflow also calls `ctx.addGuard(autoTestGuard)`, the guard runs twice. Every `step_done` event produces duplicate `run_step` demands → duplicate injected sessions → doubled cost.

**Recommendation:** Deduplicate by `guard.name` in `addGuard()`:

```typescript
addGuard(guard: WorkflowGuard): void {
  if (this.guards.some(g => g.name === guard.name)) return; // already registered
  this.guards.push(guard);
}
```

---

## Part 2: Demand Resolution — Edge Cases

### Block semantics are correct

The design says blocks always win (scan all guards first, halt if any block). This is the right call — see Open Question 1 answer below.

### `run_step` ordering is underspecified

If guard A returns `[run_step_X]` and guard B returns `[run_step_Y]`, what order do they execute? The design says "process: blocks first, then run_steps, then warns" but doesn't specify ordering *within* run_steps.

Registration order (guard A before B → step X before Y) is reasonable but should be documented explicitly. The alternative — parallel execution of injected steps — would be a future optimization, not a v1 concern.

### Cascading injection depth limit needs justification

`MAX_INJECTION_DEPTH = 3` is stated but not justified. Practically:
- Depth 0: planned step completes → guard injects test step
- Depth 1: test step completes → guard injects... what?

In practice, injected steps are utility steps (run tests, verify files). They shouldn't trigger further injection unless the test itself writes source files (unlikely). Depth 2 would suffice. Depth 3 gives a safety margin.

**This is fine.** But add a log/metric when depth 2+ is reached — it signals guard design problems.

### `injectionDepth = 0` reset placement is wrong

In the `resolveDemands()` code (Part 2), `injectionDepth` is reset to 0 at the end of the function:

```typescript
async function resolveDemands(demands: Demand[]): Promise<void> {
  // ... process run_steps, which recursively call resolveDemands ...
  injectionDepth = 0;  // Reset before next planned step
}
```

But `resolveDemands` is called recursively (injected steps trigger new events → new demands → recursive `resolveDemands`). Resetting to 0 at the bottom of a recursive call defeats the depth limit — after the first injected step resolves its sub-demands, depth resets to 0, and the second injected step at the same level starts from 0 instead of the correct depth.

**Fix:** Don't reset in `resolveDemands`. Reset in the caller (the main step loop) after all demands from a planned step are fully resolved:

```typescript
// In the main workflow loop, after each planned step:
const demands = emitAndCollectDemands(event);
injectionDepth = 0;  // Reset only at the top level
await resolveDemands(demands);
injectionDepth = 0;  // Reset after resolution completes
```

Or better: pass depth as a parameter instead of using mutable state:

```typescript
async function resolveDemands(demands: Demand[], depth: number = 0): Promise<void> {
  // ...
  if (depth >= MAX_INJECTION_DEPTH) { warnings.push(...); continue; }
  await resolveDemands(subDemands, depth + 1);
}
```

This is a **correctness bug** in the proposed implementation.

---

## Part 3: `runFunction()` — Strong Addition

### This fills a real gap

Today, verify-wrap does inline JS verification within the workflow `execute()` function. This works but doesn't emit proper events — the `ctx.emit()` calls in verify-wrap.ts (lines ~150, ~164) are manual and don't have `result` on `step_done`. `runFunction()` formalizes this pattern with proper event emission and a synthetic `TaskResult`.

### The synthetic `TaskResult` needs a marker

The `runFunction()` result creates a `TaskResult` with `sessionId: \`fn_${runId}_${stepCounter}\``. Guards inspecting `step_done` events need to distinguish function steps from LLM steps. Currently, they check `event.step.startsWith("guard:")` to skip injected steps. They'd also need to detect function steps.

**Recommendation:** Add a `source: "function" | "agent" | "guard"` field to `CompletedStep` or to the event itself, rather than relying on string prefix conventions.

### Open Question 3 Answer: `runFunction()` and guards

The proposal says: emit events, but only allow `warn` and `block` demands (skip `run_step`).

**I agree, but for a different reason.** The issue isn't that `run_step` after a function "seems odd." The issue is that function steps are data-collection steps — they don't produce deliverables that need verification. A guard returning `run_step` after a function collected some metrics would inject an LLM session to... do what? The function's output is data for the next planned step, not work product.

**Exception:** A function step that *writes files* (e.g., generates a report) could legitimately need verification. But in v1, assume functions are read-only sensors. If we need writable function steps later, we can relax this.

---

## Part 4: Heartbeat-as-Workflow Migration — **Highest Risk Area**

### The current `fireHeartbeat()` is ~220 lines of accumulated operational logic

The design says "~170 lines of context-assembly code." Reading cron.ts lines 614-854+, it's actually more, and it's not just context assembly:

1. **Request tracking** — creates/updates request DB entries (lines 636-641)
2. **Context injection** — heartbeat.md, pending tasks, last interrupted session, orphaned delegations (lines 652-766)
3. **P-EVI security wrapping** — `<retrieved_state>` tags to prevent prompt injection from task content (line 664)
4. **Auto-pause probe mode** — wraps task message for probing paused agents (lines 781-787)
5. **Tiered budget integration** — `TURN_BUDGET_TIERS.heartbeat` (line 795)
6. **Post-completion hooks** — auto-complete injected requests, notify brief, auto-pause recovery (lines 800-850+)

The proposed heartbeat workflow (Part 6) handles only #2 (context injection). Everything else is silently dropped.

**This is the biggest risk in the entire proposal.** Migrating heartbeat to a workflow without preserving:
- Request lifecycle tracking → breaks audit-requests handler, task-watchdog
- Auto-pause probe mode → breaks the entire auto-pause system
- P-EVI security wrapping → re-opens prompt injection from task content
- Post-completion hooks → breaks brief notifications, request auto-completion

**Recommendation:** Phase 3 needs a detailed migration checklist that accounts for every behavior in `fireHeartbeat()`. The "clean workflow" version in the design is aspirational — the real migration is a careful behavior-preserving refactor, not a rewrite.

### Alternative: Don't migrate heartbeat in Phase 3

Consider deferring heartbeat migration to Phase 5 (after sensor-judge migrations prove the pattern). The heartbeat is the most complex, highest-traffic cron entry. Migrating simpler handlers first (error-log-scanner, coaching-report) would validate the pattern with lower risk.

### `fireHeartbeat` already works — the cost is complexity, not performance

The 220 lines aren't causing bugs or performance problems. They're ugly but functional. The value of migrating is maintainability, not correctness. This argues for a later, more careful migration rather than rushing it in Phase 3.

---

## Part 5: Cron Handler Categories — Mostly Correct

### The categorization is sound

The four categories (Sensor→Dead Report, Sensor→Action, DB Sync, Operational Cleanup) correctly separate handlers by whether they need LLM judgment. The "stay as JS" categories (DB Sync, Operational Cleanup) are right — adding workflows to session-sync or watchdog would be pure overhead.

### Missing category: Hybrid handlers

Some handlers don't fit cleanly:
- **coaching-feedback** (lines in cron.json) — JS collects convention violations, then sends a *message* to coach (not an LLM session itself). It's sensor→dispatch, not sensor→judge. Converting to a workflow would add an unnecessary LLM step.
- **repo-gate-check** — JS runs `tsc + vitest`, then conditionally sends a request to QA agent. Same pattern: sensor→dispatch.

These should stay as JS handlers with their existing dispatch pattern. The design's "formalize as sensor-judge workflows" for Category 2 isn't right for dispatch-only handlers.

**Recommendation:** Add a Category 5: "Sensor→Dispatch" — JS collects data, conditionally sends a request to another agent. No workflow needed.

---

## Part 6: verify-wrap Migration (Phase 2) — Needs Care

The design mentions migrating verify-wrap to use guards in Phase 2. Currently, verify-wrap.ts is 190 lines of working code with:
- File extraction from session messages (3 different patterns: tool calls, tool results, compacted context)
- Placeholder pattern detection (8 patterns)
- Hard failure vs soft failure classification

If verify-wrap becomes "just run the agent + auto-test + verify-files guards," the guard implementations need to replicate all of this logic. The `extractWrittenFiles()` function in verify-wrap.ts is non-trivial (lines 35-85) and battle-tested.

**Recommendation:** When migrating verify-wrap, extract its `extractWrittenFiles()` and `verifyFile()` functions into a shared utility (e.g., `agents/shared/guards/lib/file-utils.ts`) that both guards and workflows can import. Don't rewrite these from scratch in each guard.

### The `extractChangedFiles()` dependency is hand-waved

Both example guards (auto-test, verify-files in Part 5) call `extractChangedFiles(event.result)` or `extractWrittenFiles(event.result)` — functions that don't exist yet. The `result` in a `step_done` event is a `TaskResult`, which has `messages: Message[]`. Extracting file paths from messages requires parsing tool call arguments and tool result text — exactly what verify-wrap.ts already does.

This isn't a minor utility. It's a critical dependency that makes or breaks the guard system. If `extractChangedFiles` can't reliably identify which files were modified, guards will either:
- Miss changes → no verification → quality regression
- False-positive on reads → unnecessary verification → cost regression

**Recommendation:** Phase 1 should include building and testing `extractChangedFiles()` as a first-class utility, not deferring it to "the guard will figure it out."

---

## Part 7: Performance Assessment

### Guard evaluation overhead: negligible

Guards are synchronous pure functions inspecting event data. Even with 10 guards, we're talking microseconds per event. Not a concern.

### Injected step overhead: the real cost question

Each `run_step` demand spawns a full agent session. If auto-test fires after every step that touches a .ts file, and a typical workflow has 2-3 steps, that's 2-3 extra test sessions per workflow.

Current verify-wrap handles this with pure JS verification (zero LLM cost). If the guard system replaces that with LLM-powered test sessions, we regress on the optimization that verify-wrap just completed (93% of LLM verification sessions were zero-op, leading to the JS conversion on 2026-04-13).

**Recommendation:** The auto-test guard example should default to JS-based test running (like verify-wrap's JS verification), not spawning an LLM session. Reserve `run_step` with `runAgent()` for cases where LLM judgment is actually needed.

### Heartbeat-as-workflow: potential cost regression

If heartbeat becomes a workflow, every heartbeat fires two steps: (1) `runFunction("gather-context")` and (2) `runAgent(agent, task)`. Step 2 is identical to what happens today. Step 1 is zero-cost (JS function). But the workflow overhead — workflow run tracking, event emission, demand collection, persistence — adds per-heartbeat overhead.

With 7 agents × 2 heartbeats/hour = 14 heartbeats/hour × 24 hours = 336 heartbeats/day. Even small overhead (100ms per heartbeat for workflow machinery) is only ~34 seconds/day. **Negligible.** But if guards trigger unnecessary injected steps, the LLM cost could be significant.

---

## Open Questions — Explicit Answers

### Q1: Guard ordering — should blocks always win?

**Yes. Blocks should always win, regardless of registration order.**

Rationale: A block is a safety mechanism. If guard C (registered third) detects a secret leak, it would be wrong to first execute run_step demands from guards A and B. The implementation should:
1. Collect demands from ALL guards for the event
2. If any demand is `block`, halt immediately — don't execute any `run_step`
3. Otherwise, execute `run_step` in registration order
4. Accumulate `warn` regardless

This is what the design proposes. It's correct.

### Q2: Injected step failures

**Option (c) is correct — let the guard decide.**

But with a nuance: the guard needs enough information to make a good decision. The `step_done` event for a failed injected step should include `result.status === "error"` and `result.error` with the failure details. If the auto-test guard injected a test run and it failed, the guard sees the `step_done` event for its own injected step and can return `block` if tests failed.

However, this requires guards to track their own injections — "I injected auto-test, so when I see step_done for 'guard:auto-test' with status error, I block." The current design has guards skip `event.step.startsWith("guard:")` to avoid infinite loops. These two requirements conflict.

**Resolution:** Guards should skip re-injecting on guard steps (no new `run_step`), but should still be allowed to return `block` or `warn` on guard step events. Split the "skip guard events" logic:

```typescript
// DON'T re-inject (prevents loops)
if (event.step.startsWith("guard:") && demand.type === "run_step") skip;
// DO allow block/warn (allows failure handling)
if (event.step.startsWith("guard:") && demand.type !== "run_step") allow;
```

### Q3: `runFunction()` and guards

**Events should fire. Only `warn` and `block` should be processed; `run_step` should be logged and skipped.**

See detailed reasoning in Part 3 above. The key insight: function steps are sensors, not actors. Injecting LLM steps after a sensor produces data makes no sense — the data hasn't been acted on yet.

---

## Implementation Phasing — Recommendation

The proposed 4-phase plan is mostly right but Phase 3 (heartbeat) should move later:

| Phase | Design Proposal | My Recommendation |
|-------|----------------|-------------------|
| 1 | Core demand system + runFunction | ✅ Agree — ship with verify-files guard on verify-wrap as the first test |
| 2 | Guard library + agent.json | ✅ Agree — but extract verify-wrap's file utilities first |
| 3 | Heartbeat workflow | ❌ Defer — too much accumulated behavior to migrate safely now |
| 3 (new) | Sensor-judge migrations | ✅ Start with error-log-scanner and daily-brief — simple, low-risk |
| 4 (new) | Heartbeat workflow | After sensor-judge pattern is proven, migrate heartbeat carefully |

**Phase 1 critical path:** The `extractChangedFiles()` utility is the gating dependency. Without reliable file change detection, no guard works. Build and test this first.

---

## What We Gain vs. Lose

### Gains
- **Composable quality enforcement** — guards work across all workflows, not just verify-wrap
- **Testable guards** — pure functions with deterministic behavior
- **runFunction()** — eliminates the JS-only-or-LLM-only limitation in workflows
- **Simplified cron** — sensor-judge pattern replaces disconnected report-then-read pattern
- **Guard reuse** — agent.json registration means an agent gets quality checks on every workflow automatically

### Losses / Risks
- **Debugging complexity** — when a workflow blocks, the chain is: planned step → event → guard → demand → injected step → event → guard → block. That's hard to trace without good logging.
- **Implicit behavior** — agent.json guards fire silently. A workflow author might not realize auto-test runs after every step. This could cause surprise failures or cost.
- **Migration risk** — heartbeat has 220 lines of behavior accumulated over months. Any rewrite risks dropping important edge cases.

### Mitigation for debugging
Add a `demand_log` to workflow run persistence — every event emitted, every guard that responded, every demand produced, every demand resolved. This is cheap (small JSON array) and invaluable for post-mortem.

---

## Summary of Required Changes

1. **Fix `injectionDepth` reset bug** — pass depth as parameter, don't reset in recursive calls (Part 2)
2. **Add `agent` and `workflow` to guard events** — guards should not hardcode agent names (Part 1)
3. **Build `extractChangedFiles()` as Phase 1 gating work** — don't hand-wave this (Part 6)
4. **Defer heartbeat migration to Phase 4+** — too much accumulated behavior to migrate early (Part 4)
5. **Add guard deduplication by name** — prevent double-registration cost (Part 1)
6. **Add demand_log to workflow persistence** — essential for debugging the demand chain
7. **Add source field to events/steps** — distinguish function/agent/guard steps without string prefixes

[SIG: review-guards-v2:optimizer:2026-04-14]
