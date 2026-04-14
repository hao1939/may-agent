# Design Review v2: Guards as Workflow Demands + Cron-to-Workflow Migration

**Reviewer:** Bob (Architect)  
**Document:** agents/may/workspace/DESIGN-guards-v2.md (v2)  
**Date:** 2026-04-14  
**Review type:** Follow-up review — checking resolution of C1-C10, new concerns from added sections  
**Previous review:** agents/bob/workspace/review-guards-v2.md (2026-04-14 morning)

---

## Overall Assessment: APPROVE for Phase 1

The v2 revision is substantially better. 8 of my 10 original concerns are fully addressed, 2 are partially addressed. The new sections (observability, testing, three-tier migration) are well-reasoned additions from coach, optimizer, and tech-lead. The design is ready for Phase 1 implementation with a small number of items to resolve during implementation (not blocking).

**Bottom line:** Ship Phase 1 (core demand system + auto-test guard). The remaining issues are implementation-time decisions, not design flaws.

---

## Resolution of Original Concerns (C1-C10)

### C1: TaskResult inspection / shared utilities — ✅ FULLY RESOLVED

v2 adds:
- Explicit note: "Guards MAY do compute-heavy inspection of TaskResult (regex scanning, file list extraction, JSON parsing of messages[]). Guards MUST NOT do I/O."
- Shared `workflow-utils.ts` with `extractChangedFiles()` / `extractWrittenFiles()` (extracted from verify-wrap)
- Future path: structured `deliverables` field on TaskResult

This is exactly what I asked for. The future `deliverables` field is a nice forward-looking note.

### C2: `injectionDepth` reset timing — ✅ FULLY RESOLVED

v2 explicitly states: "`injectionDepth` resets to 0 at the start of each planned step iteration — not after `resolveDemands()`." The code in Part 2 shows `injectionDepth = 0` reset at the right place. No ambiguity remains.

### C3: "Pure function" clarification — ✅ FULLY RESOLVED

v2 adds a bold callout: **"'Pure' means no side effects, not no computation."** Then enumerates what guards MAY do (regex scanning, file list extraction, JSON parsing) and MUST NOT do (filesystem reads, database queries, network calls, state mutation). Clear and precise.

### C4: Warning delivery + demand deduplication — ✅ FULLY RESOLVED

v2 specifies:
- Warnings appended to next step's task as `## Guard Warnings` section (with example)
- `run_step` demands deduplicated by label before execution
- `warnings.length = 0` after delivery (clear after use)

All three sub-items addressed.

### C5: Guard module file format — ✅ RESOLVED (differently than suggested)

I suggested agent.json registration. v2 goes with pure auto-discovery (per user requirement): scan `agents/shared/guards/*.ts` and `agents/<name>/guards/*.ts`, each file exports a `WorkflowGuard` object. This is simpler than my suggestion and consistent with how workflows are discovered. I prefer this.

### C6: Auto-prefix `guard:` on labels — ✅ FULLY RESOLVED

v2 adds structural enforcement in `resolveDemands()`:
```typescript
const prefixedLabel = label.startsWith("guard:") ? label : `guard:${label}`;
```
Guard authors can't forget the convention — the runtime enforces it.

### C7: Shared file-extraction utility — ✅ FULLY RESOLVED

Phase 0 explicitly includes: "Extract `extractChangedFiles()` / `extractWrittenFiles()` from verify-wrap into `src/lib/workflow-utils.ts`". This is a prerequisite for Phase 1, which is the right ordering.

### C8: Split cron migration into separate doc — ⚠️ PARTIALLY RESOLVED

v2 keeps everything in one doc but defers heartbeat migration to Phase 4+ ("only after Phases 1-3 are stable and proven for ≥2 weeks"). This is an acceptable compromise. The three-tier migration framework (Optimizer's contribution) makes the scope clearer — Tier 1 stays as JS, only Tier 2 converts, Tier 3 is future.

**My original concern was about scope creep.** The v2 phasing addresses this: Phase 1-2 are pure guard work, Phase 3 is Tier 2 migration, Phase 4 is heartbeat. Each phase validates before the next begins. I'm satisfied that the scope won't creep.

**Remaining nit:** The doc is now 40KB+. For implementation, the coder will need a focused spec per phase, not this whole document. Recommend extracting a Phase 1 implementation spec before coding begins.

### C9: `fireHeartbeat()` migration checklist — ✅ FULLY RESOLVED

Phase 4 now says: "Write detailed migration checklist mapping every feature of `fireHeartbeat()` to workflow equivalent." This is deferred to the right time (when we actually do the migration).

### C10: Reconcile with code-vs-data-decisions.md — ⚠️ PARTIALLY RESOLVED

v2 adds a "Relationship to existing `beforeToolCall` guards" section (Part 1) that explains coexistence. This is helpful but **doesn't update code-vs-data-decisions.md itself**, which still says:
> "NOT text rules (0/18 proven), NOT guards (brittle)"

The design doc explains why workflow-level guards are different from the brittle guards that doc criticizes (structured events vs. regex matching, demands vs. mutations, visible vs. invisible). But someone reading code-vs-data-decisions.md won't know this distinction exists.

**Action needed (non-blocking):** Update code-vs-data-decisions.md to add a note: "Workflow-level guards (event-driven, pure functions returning demands) are a different pattern from session-level `beforeToolCall` hooks. See DESIGN-guards-v2.md." This is a 2-line addition and should happen during Phase 1.

---

## New Concerns from Added Sections

### N1: Guard exception isolation (NEW, MEDIUM priority)

The testing strategy lists 8 test cases but doesn't cover: **what happens when a guard's `handle()` throws an exception?** A buggy guard that crashes shouldn't bring down the entire workflow.

**Recommendation:** Wrap each `guard.handle(event)` call in try/catch. On exception, log the error with the guard name, skip that guard's demands, and continue. Add this as test case #9.

```typescript
// In emitAndCollectDemands():
try {
  const guardDemands = guard.handle(snapshot);
  // ... process demands
} catch (err) {
  log("error", `[workflow:${runId}] guard "${guard.name}" threw: ${err}`);
  // Skip this guard, continue with others
}
```

### N2: DB schema for guard cost tracking (NEW, LOW priority)

The observability section references `guard_name` column and `source = 'guard'` filtering in SQL, but the implementation plan doesn't mention DB schema changes. The `tagSessionAsGuardInjected()` function needs a place to store this data.

**Recommendation:** Add to Phase 1: "Add `guard_name` column to sessions table (nullable, TEXT). Set when a session is created as a guard-injected step." This is a single ALTER TABLE + one column set at insert time.

### N3: Auto-test guard needs failure-path example (NEW, LOW priority)

Q2 resolved that injected step failures should be handled by guards themselves (option C — "let the guard decide"). This is the right answer. But the auto-test example in Part 5 only shows the fire-test path, not the block-on-failure path.

**Recommendation:** Add an `auto-test-block` example showing the dual behavior:
```typescript
handle(event) {
  // Path A: After a code step → demand tests
  if (!event.step.startsWith("guard:") && hasCodeChanges(event)) {
    return [{ type: "run_step", step: { label: "guard:auto-test", ... } }];
  }
  // Path B: After the test step → block if tests failed
  if (event.step === "guard:auto-test" && event.result.status === "error") {
    return [{ type: "block", reason: "Tests failed after code changes" }];
  }
  return [];
}
```

This shows the complete lifecycle and validates the Q2 design decision.

### N4: Tier 2 cost claim needs asterisk (NEW, LOW priority)

The design claims "Estimated cost impact of this migration plan: +0 ops/day." This is approximately true for Tier 2 (replacing existing LLM cost), but guards will add additional LLM sessions to Tier 2 workflows that didn't previously have verification steps. The claim should say "net cost change: approximately zero, but individual Tier 2 workflows may see +1-2 guard-injected steps per run."

Not blocking — this is a documentation accuracy issue.

### N5: `skipGuards` granularity (NEW, LOW priority)

The escape hatch is `skipGuards: true` (all-or-nothing at the workflow level). There's no way to skip a specific guard for a specific workflow invocation. This is fine for Phase 1, but if we find that one guard is problematic on one workflow, the only options are: (a) disable it globally, (b) add self-filtering to the guard, or (c) use `skipGuards: true` and lose all guards.

**Recommendation for future:** Consider `skipGuards: string[]` (list of guard names to skip) as a Phase 2 option if needed. Don't build it now — wait for evidence.

---

## Implementation Readiness Assessment

### Ready for Phase 1: YES ✅

The design has sufficient detail to begin Phase 1 implementation:

| Aspect | Ready? | Notes |
|--------|--------|-------|
| Types (`WorkflowGuard`, `Demand`, etc.) | ✅ | Fully specified in Part 1 |
| Runtime changes (`emitAndCollectDemands`, `resolveDemands`) | ✅ | Code sketches are implementation-quality |
| Guard discovery (`loadGuards`) | ✅ | Directory convention clear |
| `runFunction()` | ✅ | Error handling, timeout, truncation all specified |
| Loop protection | ✅ | Depth limit + auto-prefix + dedup |
| `WorkflowBlocked` error type | ✅ | Clear definition, fits existing error handling |
| Test cases | ✅ | 8 specific cases listed (add N1 for 9th) |
| First guard (auto-test) | ✅ | Complete implementation example |
| Where it plugs in (`workflow-tool.ts`) | ✅ | Shows exact line to change |

### Phase 1 implementation checklist (suggested)

1. Extract `extractChangedFiles` / `extractWrittenFiles` from verify-wrap → `workflow-utils.ts`
2. Add types to `workflow.ts`
3. Add `loadGuards()` to `workflow-tool.ts`
4. Add `emitAndCollectDemands()` + `resolveDemands()` to `workflow-tool.ts`
5. Add `runFunction()` to `WorkflowContext`
6. Add `WorkflowBlocked` error + handling in `runOrResume()`
7. Add guard exception isolation (N1)
8. DB: add `guard_name` column to sessions table (N2)
9. Ship `auto-test` guard in `agents/shared/guards/`
10. Write unit tests (9 cases)
11. Integration test: run a workflow with code changes, verify auto-test fires

---

## Risk Update

| Risk | From v1 | v2 Status |
|------|---------|-----------|
| Guards add latency | Medium | **Low** — pure sync functions, <1ms expected. Unchanged. |
| Guard-injected LLM cost | Medium | **Low** — `costTier` field + `maxInjectedSteps` cap + per-guard cost tracking. Well-mitigated. |
| Two guard systems confuse devs | High | **Medium** — Part 1 coexistence table is clear, but code-vs-data-decisions.md not yet updated. |
| Scope creep into cron | High | **Low** — three-tier migration + Phase 4+ deferral keeps focus on guards. |
| **NEW:** Buggy guard crashes workflow | Medium | **Needs fix** — add try/catch (N1). |
| **NEW:** DB schema not planned | Low | **Needs planning** — add to Phase 1 checklist (N2). |

---

## Summary

**v2 is a well-revised design.** The 25 changes from team feedback (especially the three-tier migration, testing strategy, and observability additions) significantly strengthen the proposal. The core abstractions remain clean: guards are pure functions, events are workflow-level, demands feed back into the runtime.

**Blocking items:** None.  
**Should-fix before Phase 1 coding:** N1 (guard exception isolation), N2 (DB schema planning).  
**Nice-to-have for Phase 1:** N3 (dual-path auto-test example), update to code-vs-data-decisions.md.  
**Defer to Phase 2+:** N4, N5.

**Verdict: APPROVE. Begin Phase 1 implementation.**

---

[SIG: review-guards-v2-followup:bob:2026-04-14]
