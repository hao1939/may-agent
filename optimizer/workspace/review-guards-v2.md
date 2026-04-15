# Review: Guards as Workflow Demands v2 — Updated Assessment

**Reviewer:** Optimizer
**Date:** 2026-04-14
**Document:** agents/may/workspace/DESIGN-guards-v2.md (v2)
**Previous review:** 2026-04-14 (v1 — all major concerns addressed in v2)

---

## Executive Summary

v2 addressed all 6 major concerns from my v1 review. The three-tier migration plan properly protects zero-LLM handlers. The guard cost tracking is sufficient for Phase 1. The cost impact estimate (+0 ops/day) is credible. **This design is ready for Phase 1 implementation.**

Two new minor issues found during this re-review (neither blocks Phase 1).

**Verdict: APPROVE for Phase 1 implementation.**

---

## Previous Concerns: Resolution Assessment

### 1. ✅ RESOLVED — Cron migration cost blind spot (was: NEEDS REWORK)

**My v1 concern:** The design proposed migrating ~8-10 pure-JS handlers to sensor-judge workflows, adding ~67 ops/day of unnecessary LLM cost.

**v2 resolution (changes #17, #25):** Rewrote to a three-tier system:
- **Tier 1** (stay JS): All 15+ pure-computation handlers explicitly listed. Zero LLM cost preserved.
- **Tier 2** (convert to workflow): Only 4 handlers that *already incur LLM cost*. Net change: ~0.
- **Tier 3** (future): Heartbeat — deferred to Phase 4+.

**Assessment:** This is exactly what I recommended. The tier assignments are correct — I verified that the Tier 2 handlers (`error-log-scanner`, `coaching-feedback`, `priority-drift`, `active-nudge`) already spawn LLM sessions or requests. Converting them to workflows replaces existing LLM cost with better-structured LLM cost.

### 2. ✅ RESOLVED — Guard cost tracking (was: MISSING)

**My v1 concern:** No mechanism to track guard-injected cost separately from planned step cost.

**v2 resolution (changes #18-20):**
- `costTier` field on `WorkflowGuard` interface (change #19)
- `tagSessionAsGuardInjected()` for DB tagging (change #18)
- `maxInjectedSteps` cost guardrail with configurable limit (change #20)
- SQL query example for per-guard cost reporting

**Assessment:** Sufficient for Phase 1. The DB already has a `source` column on sessions — the design proposes using `source: "guard"` which slots cleanly into existing infrastructure. The `maxInjectedSteps` downgrade-to-warn behavior is the right default; it prevents runaway guard cost without hard-blocking workflows.

One note: the design says `tagSessionAsGuardInjected(sessionId, guardName)` but doesn't specify the schema. The existing `source` column is TEXT — storing `"guard:auto-test"` (combining source type + guard name) would work without schema changes. Alternatively, a separate `guardName` column keeps it queryable. This is an implementation detail, not a design concern.

### 3. ✅ RESOLVED — `analyze-failures` protection (was: BLOCK)

**My v1 concern:** `analyze-failures` was intentionally de-LLM'd (saving 78 ops/week). Migration would revert that optimization.

**v2 resolution (change #21):** Explicitly listed in Tier 1 with the note: "Intentionally de-LLM'd (saved 78 ops/week). Output consumed by downstream handlers. Math, not judgment."

**Assessment:** Fully addressed. The design now calls out the specific reason this handler must stay JS.

### 4. ✅ RESOLVED — `runFunction()` in Phase 1 (was: recommendation)

**My v1 concern:** `runFunction()` should be Phase 1, not deferred.

**v2 resolution:** Phase 1 explicitly includes `runFunction()` with timeout, error handling, and truncation.

**Assessment:** Good. The `runFunction()` implementation in the design is thorough — 30s timeout, 50KB truncation, error-as-TaskResult pattern. The `source: "function"` event emission with `run_step` demand filtering is correct.

### 5. ✅ RESOLVED — Guard disable mechanism (was: MISSING)

**My v1 concern:** No way to disable a misbehaving guard without code changes.

**v2 resolution (change #13):** Two mechanisms — file rename (`.disabled` extension) and `DISABLED_GUARDS` environment variable.

**Assessment:** The env var approach is the practical one for production. File rename is good for development. Both are adequate.

### 6. ✅ RESOLVED — `beforeToolCall` convergence (was: MISSING)

**My v1 concern:** No migration path sketched for existing `beforeToolCall` guards.

**v2 resolution:** Part 1 now includes a "Relationship to existing `beforeToolCall` guards" section with a comparison table, and explicitly notes: "Future convergence: Some `beforeToolCall` guards are doing workflow-level work at the wrong layer. These can be migrated in a later phase. This is explicitly Phase 3+ work."

**Assessment:** The comparison table is clear. Deferring convergence to Phase 3+ is correct — prove the new system first.

---

## Focus Area 1: Three-Tier Migration — Zero-LLM Handler Protection

**Question:** Is the three-tier migration plan properly protecting zero-LLM handlers from regression?

**Answer: Yes.**

The protection is multi-layered:

1. **Explicit Tier 1 listing.** All 15+ zero-LLM handlers are named in a table with justification for why they stay JS. This makes it a conscious decision to move any of them.

2. **Clear criteria.** Tier 1 criterion: "Output is deterministic/numeric, no judgment required, no existing LLM cost." Tier 2 criterion: "Already incurs LLM cost; workflow makes it atomic and guarded." The criteria are falsifiable — you can verify each handler against them.

3. **Cost impact estimate.** The "+0 ops/day" estimate is stated and justified: Tier 1 stays zero, Tier 2 replaces existing cost.

4. **Infrastructure handlers separated.** Watchdog, zombie-cleanup, session-sync, etc. are explicitly called out as "stay as cron handlers" in the "What does NOT change" section.

**One minor gap:** The design doesn't mention `convention-check`, `repo-gate-check`, `tracker-compact`, or `run-agent-task` handlers (I see them in the handlers directory). These presumably fall into Tier 1 or are infrastructure, but they're not listed. This isn't blocking — the Phase 0 audit will catch them — but the Tier 1 table should eventually be exhaustive.

---

## Focus Area 2: Guard Cost Tracking Sufficiency

**Question:** Is the guard cost tracking (`costTier`, `maxInjectedSteps`, DB tagging) sufficient?

**Answer: Yes, for Phase 1. One enhancement recommended for Phase 2.**

What's tracked:
- **Per-guard session tagging** via `tagSessionAsGuardInjected()` — enables `SELECT guard_name, COUNT(*), SUM(op_count) FROM sessions WHERE source = 'guard' GROUP BY guard_name`
- **`costTier`** on guard interface — declarative cost expectation for monitoring/alerting
- **`maxInjectedSteps`** — automatic cost cap per workflow run
- **Demand logging** — every guard reaction is logged with guard name, demand type, and reason

What's missing (Phase 2):
- **`costTier` validation.** The design declares `costTier` on guards but never validates it against actual cost. A "zero" cost-tier guard that produces `run_step` demands is a contradiction. Phase 2 should add a check: if `costTier === "zero"`, the guard MUST NOT produce `run_step` demands (only `block` and `warn`). This is a simple static assertion during guard loading.
- **Guard overhead ratio reporting.** The SQL query is provided but no scheduled reporting. The optimizer or a handler should periodically run this query and alert if guard overhead exceeds a threshold (e.g., guard ops > 20% of planned step ops). This can be a Tier 1 handler — pure computation, no LLM needed.

---

## Focus Area 3: Cost Impact Estimate Credibility

**Question:** Are the cost impact estimates credible?

**Answer: Yes.**

The design claims "+0 ops/day" from the migration plan. Let me validate:

| Source | Claimed cost | My assessment |
|--------|-------------|---------------|
| Guard evaluation (pure functions) | ~0 | ✅ Correct — microsecond function calls against second-scale steps |
| Tier 1 handlers (stay JS) | 0 added | ✅ Correct — no change |
| Tier 2 handlers (workflow) | ~0 net change | ✅ Credible — these already trigger LLM via `manager.run()` or requests. I verified `error-log-scanner` calls `ctx.manager.run("may", judgePrompt, { source: "handler" })` at line 392. Workflow replaces this with a structured `runAgent()` — same LLM invocation, better context. |
| Guard-injected steps (auto-test, etc.) | Not quantified separately | ⚠️ See note below |

**Note on guard-injected cost:** The "+0 ops/day" estimate covers the *migration*. It does NOT include the cost of guard-injected steps (auto-test, verify-files) once they're deployed. Each `auto-test` firing adds ~5-10 ops. If workflows run ~10x/day and auto-test fires on ~50% of them, that's ~25-50 ops/day of guard overhead.

This is **intentional new cost** (we're buying quality assurance), not migration cost. The design correctly treats these as separate. But the design should explicitly state: "Guard-injected steps are an intentional new cost investment, expected ~25-50 ops/day, bounded by `maxInjectedSteps`." Currently this is implicit.

---

## Focus Area 4: Phase 1 Implementation Readiness

**Question:** Is this ready for Phase 1 coding?

**Answer: Yes, with one clarification needed.**

### What's ready:

1. **Types are fully specified.** `WorkflowGuard`, `Demand`, `WorkflowGuardEvent`, `WorkflowBlocked` — all have complete TypeScript interfaces with field-level documentation.

2. **Integration points are identified.** The design shows exactly where code changes go:
   - `src/lib/workflow.ts` — new types
   - `src/lib/workflow-tool.ts` — guard loading in `executeWorkflow()`, demand resolution replacing current `onEvent` calls
   - `src/lib/workflow-utils.ts` — new file, extracted from `verify-wrap.ts`
   - `agents/shared/guards/` — new directory with guard implementations

3. **The insertion point is specific.** Line ~319 of workflow-tool.ts: `onEvent?.({ type: "step_done", ... })` becomes `emitAndCollectDemands()` + `resolveDemands()`. I verified this line exists.

4. **Test cases are enumerated.** 8 specific unit tests listed (guard evaluation, demand resolution order, depth limit, deduplication, WorkflowBlocked propagation, runFunction step counting, runFunction error handling, completedSteps snapshot).

5. **Existing types are compatible.** The current `WorkflowEvent` type (in `workflow.ts`) has `step_done` and `step_start` events. The proposed `WorkflowGuardEvent` extends these with `source`, `completedSteps`, and `task` fields. This is additive — no breaking changes.

### Clarification needed:

**Guard loading mechanism.** The design says `loadGuards()` scans directories and loads `.ts` files. But the existing workflow loading in `workflow-tool.ts` uses dynamic `import()` for workflow modules. Guards should use the same pattern — `import()` the `.ts` file, validate it exports a `guard: WorkflowGuard` object. The design should specify the export convention:

```typescript
// Guards export a named `guard` object:
export const guard: WorkflowGuard = { ... };
```

The design's examples already use this convention (Part 5), but `loadGuards()` implementation should validate this at load time and log a clear error if a file in the guards directory doesn't export `guard`.

This is minor — it's an implementation detail, not a design gap.

---

## NEW Issues (not in v1 review)

### NEW-1: `injectionDepth` reset timing — potential edge case (LOW)

The design says: "`injectionDepth` resets to 0 at the start of each **planned** step iteration."

But `resolveDemands()` also resets it: `injectionDepth = 0; // Reset before next planned step` (at the bottom of the function). If `resolveDemands()` is called for both `step_start` and `step_done` events, the depth resets twice per planned step. This is harmless (resetting to 0 twice is idempotent), but the code comment is misleading — it should say "Reset after resolving demands for this event" not "Reset before next planned step."

More importantly: if a guard fires on `step_start` AND `step_done` for the same planned step, each gets a fresh depth budget. So a pathological guard could inject `MAX_INJECTION_DEPTH` steps on `step_start` AND another `MAX_INJECTION_DEPTH` on `step_done`, totaling 6 injected steps from one planned step. The `maxInjectedSteps` global cap catches this, so it's not dangerous. But the depth reset semantics should be documented clearly.

**Recommendation:** Keep the reset behavior as-is (it's simpler), but add a comment noting that `maxInjectedSteps` is the primary cost cap, not `MAX_INJECTION_DEPTH`.

### NEW-2: `runFunction()` return type mismatch with `TaskResult` (LOW)

The design creates a synthetic `TaskResult` from `runFunction()` with `messages: []`. But the example guards use `extractChangedFiles(event.result)` and `extractWrittenFiles(event.result)`, which parse `result.messages[]` to find file operations.

For function steps, `messages` is always empty — these extraction functions will always return `[]`. This is correct (function steps don't write files), but it means a guard that naively checks `extractChangedFiles(event.result)` without checking `event.source` will silently skip function events. The `source: "function"` field makes this explicit, and the design already filters out `run_step` demands from function events, so this is handled. But it's worth noting in the `runFunction()` docs: "Function step TaskResults have `messages: []` — guards should use `event.source` to distinguish, not rely on message content."

---

## Summary

| Item | v1 Verdict | v2 Verdict | Notes |
|------|-----------|-----------|-------|
| Guard demand model | ✅ Approve | ✅ Approve | No changes needed |
| `runFunction()` | ✅ Strong approve | ✅ Strong approve | Now in Phase 1 — good |
| Three-tier migration | ❌ Rework | ✅ Approve | All concerns addressed |
| Guard cost tracking | ⚠️ Missing | ✅ Approve | Sufficient for Phase 1; add `costTier` validation in Phase 2 |
| Cost impact estimates | — | ✅ Credible | +0 ops/day for migration; ~25-50 ops/day for guard-injected steps (intentional) |
| Phase 1 readiness | — | ✅ Ready | Types, integration points, tests all specified |
| `beforeToolCall` convergence | ⚠️ Missing | ✅ Approve | Deferred to Phase 3+ — correct |
| Guard disable mechanism | ⚠️ Missing | ✅ Approve | File rename + env var |
| NEW-1: Depth reset timing | — | ⚠️ Minor | Document that `maxInjectedSteps` is primary cap |
| NEW-2: runFunction messages | — | ⚠️ Minor | Note in docs that function TaskResults have empty messages |

**Overall: APPROVE. Ready for Phase 1 implementation.**

The two new minor issues (NEW-1, NEW-2) can be addressed during implementation — neither requires design changes.

---

*Estimated guard overhead once Phase 1 + Phase 2 deployed: ~25-50 ops/day from auto-test + verify-files guard injections. This is intentional cost investment in quality assurance, bounded by `maxInjectedSteps` (default: 5 per workflow run).*
