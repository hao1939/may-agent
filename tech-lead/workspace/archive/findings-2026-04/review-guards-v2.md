# Review: Guards as Workflow Demands v2 — Follow-Up Review

**Reviewer:** Tech Lead  
**Date:** 2026-04-14  
**Design:** `agents/may/workspace/DESIGN-guards-v2.md` (v2, revised per team feedback)  
**Previous review:** `agents/tech-lead/workspace/review-guards-v2.md` (overwritten)  
**Verdict:** **Approve for Phase 1 implementation** — all original concerns addressed. Two minor notes below.

---

## Original Concerns: Resolution Assessment

### C1 (RESOLVED ✅): `extractChangedFiles()` / `extractWrittenFiles()` are load-bearing but undefined

**What I said:** These functions parse `TaskResult` which has no structured `filesModified` field. Parsing `lastAssistantText` or `messages[]` is brittle. Recommended adding `deliverables` to `TaskResult`.

**How v2 addresses it (Change #1):** 
- Shared utilities extracted to `src/lib/workflow-utils.ts` (from verify-wrap, which already does this parsing)
- Acknowledged the future `deliverables` field improvement but explicitly deferred it: "For v1, parsing `messages[]` is acceptable — it's the same approach `verify-wrap` uses today."

**Assessment:** Acceptable. Three workflows already use `extractWrittenFiles()` with `messages[]` parsing (verify-wrap, investigate-and-fix, lens-analysis). The pattern is proven. Extracting to a shared utility is the right first step. Adding `deliverables` to `TaskResult` is a Phase 2+ improvement, not a blocker.

### C2 (RESOLVED ✅): Guard-injected steps are full LLM sessions — cost visibility

**What I said:** Auto-test spawns bob sessions at ~5-15 ops each. Needs cost tracking and `maxInjectedSteps` limit.

**How v2 addresses it (Changes #18, #19, #20):**
- Guard-injected sessions tagged with `source: "guard"` and guard name in DB
- `costTier` field on `WorkflowGuard` interface for monitoring
- `maxInjectedSteps` (default: 5) — further demands downgrade to `warn`

**Assessment:** Fully addressed. The SQL query example (`SELECT guard_name, COUNT(*), SUM(op_count)`) makes cost monitoring trivial. The `maxInjectedSteps` cap prevents runaway cost.

### C3 (RESOLVED ✅): Three registration sources is one too many

**What I said:** Cut agent-level registration for v1. Workflow-level is more precise.

**How v2 addresses it (Changes #22, #23):** Eliminated ALL registration. Guards are auto-discovered from directories (`agents/shared/guards/`, `agents/<name>/guards/`). No `agent.json` field, no `ctx.addGuard()`, no registration API.

**Assessment:** This is *better* than what I recommended. Auto-discovery with self-filtering is the cleanest approach. Add a file → it works. Remove a file → it stops. Guards own their own applicability logic via the `handle()` function. No "why did this guard fire?" debugging — just read the guard file.

### C4 (RESOLVED ✅): `completedSteps` passed by reference creates ordering bugs

**What I said:** Guards receive a mutable array. Guard A's demand modifies `completedSteps` before Guard B evaluates.

**How v2 addresses it (Change #9):** `[...completedSteps]` snapshot passed to guard handlers. Shown explicitly in `emitAndCollectDemands()`:
```typescript
const snapshot = { ...event, completedSteps: [...event.completedSteps] };
const guardDemands = guard.handle(snapshot);
```

**Assessment:** Exactly right. Shallow copy is sufficient since `CompletedStep` objects are read-only from the guard's perspective.

### C5 (RESOLVED ✅): Heartbeat migration is high-risk with unclear benefit

**What I said:** Do heartbeat migration LAST, not third.

**How v2 addresses it (Change #24):** Heartbeat is now Phase 4+ ("future, when system is mature"). Requires 2 weeks of stability in Phases 1-3, pilot with one non-critical agent, 1-week parallel run before broader rollout.

**Assessment:** Fully addressed. The detailed rollout criteria in Phase 4+ show good discipline.

### C6 (RESOLVED ✅): 28 handlers need triage before implementation

**What I said:** Add Phase 0 audit.

**How v2 addresses it (Changes #17, #25):** 
- Three-tier migration system (Stay JS / Convert to workflow / Future heartbeat)
- Explicit Phase 0: "Complete inventory of all 28 JS handlers with fire frequency, LLM cost, and consumer chain"
- Tier 1 handlers (15 named) explicitly protected from migration
- `analyze-failures` specifically called out as intentionally de-LLM'd (Change #21)
- Estimated cost impact: +0 ops/day

**Assessment:** The three-tier system is excellent. The Optimizer's contribution here is the most impactful change in v2 — it transforms a vague "migrate everything" into a surgical "migrate only what already incurs LLM cost."

### Missing pieces I flagged (Testing, Observability, Disable mechanism)

**Testing (Change #11):** 8 specific test cases listed. Covers guard evaluation, demand resolution order, injection depth, dedup, `WorkflowBlocked`, `runFunction()` step counting/error handling, snapshot isolation.

**Observability (Change #12):** Logging format specified with examples. Every demand logged with workflow runId, guard name, demand type, and reason.

**Disable mechanism (Change #13):** Two mechanisms — file rename (`.disabled` extension) and `DISABLED_GUARDS` env var. Both are zero-code-change.

**Assessment:** All three addressed. The testing strategy is comprehensive — these 8 tests will catch the most likely failure modes.

### `runFunction()` gaps I noted (step counter, persistence)

**How v2 addresses it (test cases #6 and #7):** Step counter increment and persistence are called out as explicit test cases. The implementation code now shows `stepCounter++` and `localSteps.push(step); completedSteps.push(step)`.

**Assessment:** Addressed in both implementation code and test plan.

### `source: "agent" | "function"` field

**How v2 addresses it (Change #10):** Added to `WorkflowGuardEvent` type. `run_step` demands from function-source events are filtered out at the runtime level. Guards can also self-filter: `if (event.source === "function") return [];`.

**Assessment:** Exactly what I recommended. The dual-layer filtering (runtime filters `run_step` + guards self-filter) is belt-and-suspenders without being redundant — the runtime layer is a safety net, the guard layer is explicit documentation.

---

## New Observations on v2

### N1 (Minor): `injectionDepth` reset timing

The design says: "injectionDepth resets to 0 at the start of each planned step iteration — not after resolveDemands()."

But the implementation code shows `injectionDepth = 0;` at the end of `resolveDemands()`. This is a doc/code mismatch. The behavior should be: reset at the start of each planned step's event processing. The resolveDemands function shouldn't reset it because recursive calls to resolveDemands (from injected step events) would incorrectly reset the counter mid-chain.

**Recommendation:** Move the reset to `executeWorkflow()`'s main loop, before calling `emitAndCollectDemands()` for each planned step. Not a blocker — easy to catch in implementation.

### N2 (Note): Guard file loading is async at workflow start

The design says guards are loaded when a workflow starts: `const guards = await loadGuards(...)`. This means:
- Guard files are TypeScript (need compilation/import)
- Loading happens on every workflow execution

For Phase 1 this is fine — there will be 1-3 guard files. If the guard library grows to 10+, consider caching loaded guards (invalidate on file change). Not a concern now.

### N3 (Positive): The "future convergence" note about `beforeToolCall` guards

The design explicitly says: "Some `beforeToolCall` guards (like the verification-depth guard and completeness guard) are doing workflow-level work at the wrong layer. These can be migrated to workflow guards in a later phase." This is exactly the architectural direction I noted in my v1 review. Good to see it documented but explicitly deferred.

---

## Implementation Readiness Assessment

### Phase 1 is ready to code. Specifically:

**Types (workflow.ts, ~40 lines):**
- `WorkflowGuardEvent` (4 event variants with `source`, `completedSteps`)
- `WorkflowGuard` interface (name, events, costTier, handle)
- `Demand` interface (type, reason, guardName, step)
- `WorkflowBlocked` error class

**Runtime (workflow-tool.ts, ~100 lines):**
- `loadGuards()` — scan two directories, import guard files
- `emitAndCollectDemands()` — emit event to existing `onEvent` + all guards, collect demands
- `resolveDemands()` — blocks → halt, warns → collect, run_steps → dedupe + execute
- `runFunction()` — synthetic TaskResult, stepCounter++, persist to localSteps/completedSteps

**Shared utilities (workflow-utils.ts, ~60 lines):**
- `extractChangedFiles()` / `extractWrittenFiles()` — extract from verify-wrap (already proven)

**First guard (agents/shared/guards/auto-test.ts, ~30 lines):**
- Self-filtering (skip function sources, skip guard: steps, skip if no src files changed)

**Tests (8 test cases from Part 7):**
1. Guard evaluation → expected demands
2. Demand resolution order (blocks halt before run_steps)
3. Injection depth limit → warnings at depth > MAX
4. Dedup by label
5. `WorkflowBlocked` propagation
6. `runFunction()` step counting
7. `runFunction()` error handling (timeout, throw, truncation)
8. `completedSteps` snapshot isolation

**Total estimate: ~230 lines of production code + ~200 lines of tests.** Manageable in a 2-3 day sprint.

### One implementation note:

The `tagSessionAsGuardInjected()` function (called in `resolveDemands()`) needs to write to the sessions DB. This should be a simple `UPDATE sessions SET source = 'guard', guard_name = ? WHERE id = ?`. Verify the `sessions` table has (or can have added) `source` and `guard_name` columns. If schema migration is needed, do it in Phase 0 prep.

---

## Summary

| Original Concern | Status | Quality of Resolution |
|------------------|--------|----------------------|
| C1: extractChangedFiles brittleness | ✅ Resolved | Good — shared utility from proven pattern, structured field deferred |
| C2: Injected step cost visibility | ✅ Resolved | Excellent — DB tagging + costTier + maxInjectedSteps |
| C3: Too many registration sources | ✅ Resolved | Better than asked — auto-discovery eliminates registration entirely |
| C4: completedSteps mutation | ✅ Resolved | Exact fix recommended — snapshot via spread |
| C5: Heartbeat migration risk | ✅ Resolved | Phase 4+ with 2-week stability gate and pilot rollout |
| C6: Handler triage needed | ✅ Resolved | Three-tier system with explicit Phase 0 audit |
| Missing: Testing strategy | ✅ Added | 8 specific test cases covering all critical paths |
| Missing: Observability | ✅ Added | Logging format with examples |
| Missing: Disable mechanism | ✅ Added | File rename + env var |
| Missing: `beforeToolCall` relationship | ✅ Added | Comparison table + future convergence note |

**New issues:** N1 (minor doc/code mismatch on `injectionDepth` reset) — easy fix during implementation.

**Verdict: Approve for Phase 1 implementation.** The design is thorough, all original concerns are addressed, the scope is right-sized, and the phased rollout is disciplined. Ship it.
