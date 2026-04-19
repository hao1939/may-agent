# Review: Guards as Workflow Demands v2 — Follow-up Review

**Reviewer:** Coach  
**Date:** 2026-04-14  
**Design:** `agents/may/workspace/DESIGN-guards-v2.md` (v2)  
**Review type:** Follow-up — checking whether v1 concerns were addressed + new issues  
**Previous review:** v1 review (same file, overwritten)

---

## Status of Previous Concerns

### Concern #1 (High): Agent Visibility — ✅ FULLY ADDRESSED

The v2 design adds a dedicated "Agent visibility: what does the agent see?" section covering all four cases (run_step, warn, block, no-fire). This is exactly what I asked for. The description of how `[guard:...]` prefixes work as visible scaffolding is well-motivated. The `## Guard Warnings` delivery mechanism is simple and clear.

**One thing I especially like:** The framing of guard visibility as *scaffolding for learning* — "Over time, agents can learn to run tests proactively (because they see the guard always injects tests after code changes)." This is the right pedagogical model. Guards should make themselves obsolete by teaching.

### Concern #2 (High): Heartbeat Migration Risk — ✅ FULLY ADDRESSED

Heartbeat migration is now Phase 4+ with explicit maturity gate: "Only after Phases 1-3 are stable and proven for ≥2 weeks." The migration plan includes detailed preconditions: write a migration checklist, migrate ONE non-critical agent first, run in parallel for 1 week, compare quality metrics. This is exactly the level of caution I wanted.

### Concern #3 (Medium): runFunction() Error Handling — ✅ FULLY ADDRESSED

The v2 `runFunction()` implementation includes:
- 30-second timeout via `Promise.race()`
- Error catch that returns a `TaskResult` with `status: "error"` instead of crashing
- Output truncation at 50KB
- The error result still gets pushed to `completedSteps` (good — the workflow knows the step ran and failed)

The test plan includes specific test cases for timeout, throw, and truncation. Solid.

### Concern #4 (Medium): Depth-Limit Warning Details — ✅ FULLY ADDRESSED

The warning format now includes full context: `"Demand skipped (depth limit 3): 2 source file(s) modified — running tests [auto-test] — would inject "guard:auto-test""`. This is exactly what I asked for.

### Concern #5 (Low): Guard Discoverability — ✅ ADDRESSED

`agents/shared/guards/REGISTRY.md` is specified, auto-generated from guard metadata. Good enough for Phase 1.

### Concern #6 (Low): beforeToolCall Redundancy — ✅ ADDRESSED

The "Relationship to existing `beforeToolCall` guards" section explicitly describes the two layers, their different scopes, and notes that convergence is "Phase 3+ work — no rush." The "Future convergence" framing is good — it acknowledges the redundancy without forcing a premature migration.

---

## Overall Assessment of v2

**All 6 of my original concerns are addressed satisfactorily.** The v2 design is substantially more complete than v1. The 25 changes from four reviewers are well-integrated — the document reads cohesively rather than like a patchwork of additions.

---

## New Issues in v2

### New Concern A (Medium): `injectionDepth` reset timing may cause confusion

The design says:

> `injectionDepth` resets to 0 at the start of each **planned** step iteration — not after `resolveDemands()`.

But looking at the code, `injectionDepth = 0` is the last line inside `resolveDemands()`:

```typescript
async function resolveDemands(demands: Demand[]): Promise<void> {
  // ... process all demands ...
  injectionDepth = 0;  // Reset before next planned step
}
```

This means `injectionDepth` resets at the end of `resolveDemands()`, which is called after `emitAndCollectDemands()` for each planned step. If `resolveDemands()` is called recursively (from an injected step's sub-demands), the inner call's reset will zero out `injectionDepth` while the outer call is still processing its demand list.

**Scenario:** Guard A and Guard B both produce `run_step` demands from the same event. Guard A's step runs → triggers sub-demands → recursive `resolveDemands()` → resets `injectionDepth = 0`. Now Guard B's step runs with a fresh depth counter, effectively bypassing the depth limit.

**Recommendation:** Move the reset OUT of `resolveDemands()` and into the top-level loop in `executeWorkflow()`. Or: only reset depth at the top of each planned step iteration, not inside the recursive function. The current placement creates a subtle bug where multiple `run_step` demands from the same event each get a full depth budget.

### New Concern B (Low): `maxInjectedSteps` vs `MAX_INJECTION_DEPTH` — two limits, different axes

The design has:
- `MAX_INJECTION_DEPTH = 3` — guards on guards on guards (recursion depth)
- `maxInjectedSteps` (default 5) — total injected steps per workflow run (volume cap)

This is reasonable as two orthogonal limits, but the interaction isn't documented. A workflow could hit `maxInjectedSteps` before any single chain hits `MAX_INJECTION_DEPTH` (wide but shallow), or vice versa (narrow but deep). When `maxInjectedSteps` triggers, demands downgrade to `warn`. When `MAX_INJECTION_DEPTH` triggers, demands are also warnings.

The agent experience is identical for both limits — a `## Guard Warnings` message saying "demand skipped." But the *causes* and *remedies* are different: hitting depth means circular guard interactions, hitting volume means too many guards firing on the same workflow.

**Recommendation:** The downgraded warning should indicate *which* limit was hit so debugging is straightforward. The depth-limit message already does this well (`"depth limit 3"`). Just ensure the `maxInjectedSteps` message is equally clear, e.g., `"Demand downgraded (total injected steps limit 5): ..."`.

### New Concern C (Low): Guard error handling — what if `handle()` throws?

The design specifies guards MUST be pure functions, and the test plan includes "Guard evaluation: Given an event, guard returns expected demands." But there's no specification for what happens when a guard's `handle()` function throws an exception (due to a bug, bad regex, unexpected event shape, etc.).

The runtime should NOT let a buggy guard crash the workflow. This is a simple defensive pattern:

```typescript
try {
  const guardDemands = guard.handle(snapshot);
  // ...
} catch (err) {
  log("error", `[workflow:${runId}] guard "${guard.name}" threw: ${err}`);
  // Continue — skip this guard, don't block the workflow
}
```

**Recommendation:** Add a try/catch around `guard.handle()` in `emitAndCollectDemands()`, with logging. A broken guard should degrade gracefully (skip + warn), not crash the workflow. Add this as test case #9.

---

## Scaffolding Learning Model — Brief Commentary

The v2 design introduces an implicit learning theory: guards are visible scaffolding that agents can internalize over time. The `[guard:...]` prefix and `## Guard Warnings` make interventions visible so agents learn the *pattern* (e.g., "tests should run after code changes") and eventually do it proactively.

I think this is a good model but want to flag a realistic expectation: **agents in oneshot mode won't learn from guards within a session**. The learning happens across sessions via context accumulation (e.g., a knowledge entry like "always run tests after modifying source files"). The guard system itself doesn't create this feedback loop — someone (Coach, or a meta-guard, or the agent's own reflection) needs to notice recurring guard interventions and encode them as knowledge.

This isn't a design flaw — it's a follow-on capability that should be tracked. Consider adding a Phase 2+ item: "Analyze guard firing frequency per agent → surface patterns as coaching opportunities."

---

## Implementation Readiness Assessment

**Is this ready for Phase 1 coding?** Yes, with one fix needed first.

| Aspect | Ready? | Notes |
|--------|--------|-------|
| Type definitions | ✅ | `WorkflowGuard`, `Demand`, `WorkflowGuardEvent`, `WorkflowBlocked` are well-specified |
| Guard discovery | ✅ | Directory convention + `loadGuards()` scanning is clean |
| Demand resolution | ⚠️ | Fix the `injectionDepth` reset timing (Concern A) before implementing |
| `runFunction()` | ✅ | Error handling, timeout, truncation all specified |
| Observability | ✅ | Logging format, cost tags, disable mechanism all present |
| Test plan | ✅ | 8 specific test cases covering key behaviors; add guard-throws as #9 |
| Guard examples | ✅ | auto-test, verify-files, no-secret-leak are clear templates |
| Phase plan | ✅ | Sensible progression with maturity gates between phases |

---

## Summary of New Recommendations

| # | Priority | Recommendation |
|---|----------|----------------|
| A | **Medium** | Fix `injectionDepth = 0` reset location — it's inside `resolveDemands()` but should be outside the recursive function to avoid resetting mid-demand-batch |
| B | **Low** | Ensure `maxInjectedSteps` downgrade message clearly states which limit was hit |
| C | **Low** | Add try/catch around `guard.handle()` — a broken guard should not crash the workflow |
| — | **Note** | Consider tracking guard-firing patterns as coaching inputs (Phase 2+) |

## Verdict

**Approve.** All original concerns are addressed. Three new minor issues identified (one medium, two low). The medium issue (Concern A: injection depth reset) should be fixed in the implementation — it's a subtle concurrency bug that will be hard to debug in production. The rest are straightforward.

The design is ready for Phase 1 implementation.
