# Design Review Round 2: Guards as Workflow Demands v2

**Reviewer:** Optimizer  
**Date:** 2026-04-14  
**Document:** `agents/may/workspace/DESIGN-guards-v2.md` (v2, 25 changes from team feedback)  
**Previous reviews:** `review-guards-v2-demands.md` (v1 detailed), `review-guards-v2.md` (v2 first pass)  
**Round 2 focus:** Verify previous concerns addressed, raise NEW issues, deep-dive on three areas.

---

## Executive Summary

**Verdict: APPROVE — Ready for Phase 1 implementation.**

My v1 review raised 7 required changes. The v2 design addressed all 7 — some directly (heartbeat deferral, source field, extractChangedFiles commitment), some via alternative approaches that I accept (auto-discovery eliminates deduplication concern, demand_log deferred to implementation). My v2 first-pass review confirmed this and found 2 minor issues (NEW-1: depth reset, NEW-2: runFunction messages).

This round 2 review deep-dives into three focus areas from the task brief. I found **zero blocking issues**. One new observation (NEW-3) is noted for implementation awareness.

---

## Focus Area 1: Three-Tier Migration — Zero-LLM Handler Protection

### Assessment: SOLID

The three-tier system (change #17, #25) is exactly what I recommended in v1. Verification:

| Check | Status | Evidence |
|-------|--------|---------|
| Tier 1 lists all pure-computation handlers | ✅ | 15+ handlers named with justification. Includes `analyze-failures` (my explicit concern — change #21). |
| Tier 2 limited to handlers that already incur LLM cost | ✅ | 4 handlers: `error-log-scanner`, `coaching-feedback`, `priority-drift`, `active-nudge`. I verified in v1 that `error-log-scanner` calls `ctx.manager.run()`. |
| Tier 3 (heartbeat) deferred to Phase 4+ | ✅ | Change #24 — heartbeat migration requires 2 weeks of proven stability first. This addresses my v1 concern #4 about the 220-line `fireHeartbeat()` behavior-preservation risk. |
| Infrastructure handlers protected | ✅ | Watchdog, zombie-cleanup, session-sync, etc. explicitly in "What does NOT change" section. |
| Cost impact estimate credible | ✅ | "+0 ops/day" for migration is correct. Tier 1 = no change, Tier 2 = replace existing LLM cost with structured LLM cost. |

**One gap noted in v2 first-pass (still valid):** Handlers `convention-check`, `repo-gate-check`, `tracker-compact`, `run-agent-task` are not explicitly listed in any tier. The Phase 0 audit (1 day) will catch these. Not blocking.

**My v1 concern about "Sensor→Dispatch" handlers** (coaching-feedback dispatches to coach without running LLM itself): The v2 design lists coaching-feedback as Tier 2 with justification "Coach sees raw data in-context instead of reading a stale file." This is reasonable — the dispatch already incurs LLM cost (in the *receiving* agent's session), and a workflow keeps context together. I accept this categorization.

### Protection mechanism strength

The three-tier system protects zero-LLM handlers via:
1. **Positive listing** — handlers must be explicitly promoted to Tier 2, not accidentally swept up.
2. **Clear criteria** — "deterministic/numeric, no judgment, no existing LLM cost" is falsifiable.
3. **Phase gating** — Tier 2 migrations happen in Phase 3, *after* the demand system is proven in Phase 1-2.

This is defense-in-depth against cost regression. Satisfied.

---

## Focus Area 2: Guard Cost Tracking — Mechanism Soundness

### Assessment: SUFFICIENT FOR PHASE 1

The cost tracking has four components:

**1. DB tagging (`tagSessionAsGuardInjected`)** — ✅ Sound  
Guard-injected sessions get tagged with `source: "guard"` and guard name. The existing `source` column on sessions accommodates this. Enables `SELECT guard_name, COUNT(*), SUM(op_count) FROM sessions WHERE source = 'guard' GROUP BY guard_name`. This is the primary cost visibility mechanism and it works.

**2. `costTier` field** — ✅ Sound (with Phase 2 follow-up)  
Declarative intent: `"zero"` (block/warn only), `"low"` (occasional run_step), `"medium"` (frequent run_step). Currently informational — no runtime enforcement. My v2 first-pass recommended Phase 2 validation: if `costTier === "zero"`, reject `run_step` demands at load time. This is a good hardening step but not Phase 1 blocking.

**3. `maxInjectedSteps`** — ✅ Sound  
Global cap per workflow run (default: 5). Excess `run_step` demands downgrade to `warn`. This prevents runaway guard cost even if individual guards misbehave. The downgrade-to-warn behavior is correct — it preserves the information (guard wanted to act) while limiting the cost.

**4. Demand logging** — ✅ Sound  
Every guard reaction logged: `[workflow:run_abc] guard "auto-test" produced run_step: ...`. This provides operational visibility. My v1 asked for `demand_log` in workflow persistence — the design's logging approach is adequate for Phase 1. Structured persistence can come later.

### Cost projection (restated for completeness)

The "+0 ops/day" estimate covers migration cost only. Guard-injected steps (auto-test, verify-files) are intentional new cost:
- Estimated: ~25-50 ops/day once Phase 1+2 deployed
- Bounded by: `maxInjectedSteps` (default 5 per workflow run)
- Measurable via: DB tagging + the SQL query provided

The design should explicitly state this as "intentional quality investment" (it's currently implicit). Minor documentation gap, not blocking.

---

## Focus Area 3: Architectural Concerns — Round 2 Check

### v1 Concern Resolution Audit

| v1 Required Change | v2 Resolution | Accepted? |
|---|---|---|
| **1. Fix `injectionDepth` reset bug** — pass depth as parameter | v2 keeps mutable state but resets "at start of each planned step iteration." NEW-1 noted the double-reset is harmless but `maxInjectedSteps` is the real cap. | ✅ Accepted — `maxInjectedSteps` catches the edge case. Implementation should use parameter-passing per my v1 recommendation, but design is sound either way. |
| **2. Add `agent` and `workflow` to guard events** | v2 adds `task: string` to all events. `agent` and `workflow` are not explicitly added. | ⚠️ Partially addressed — `task` helps, but the auto-test example still hardcodes `agent: "bob"`. Implementation should add `agent` field. Not design-blocking. |
| **3. Build `extractChangedFiles()` as Phase 1 work** | v2 Phase 1 explicitly includes: "Extract `extractChangedFiles()` / `extractWrittenFiles()` from verify-wrap into `src/lib/workflow-utils.ts`." Phase 0 also lists this extraction. | ✅ Fully addressed. |
| **4. Defer heartbeat migration** | v2 moves heartbeat to Phase 4+ with 2-week stability requirement and detailed migration checklist requirement. | ✅ Fully addressed. Exactly what I recommended. |
| **5. Add guard deduplication by name** | v2 uses auto-discovery (no registration API). Guards loaded from directory scan — each file loaded once. Deduplication concern eliminated by architecture change. | ✅ Resolved differently but correctly. Auto-discovery makes double-registration impossible. |
| **6. Add `demand_log` to workflow persistence** | Not explicitly in v2. Demand logging to stdout is included. | ⚠️ Partially addressed. Stdout logging is adequate for Phase 1. Structured persistence is a Phase 2 enhancement. |
| **7. Add `source` field to events/steps** | v2 adds `source: "agent" \| "function"` to `WorkflowGuardEvent` (change #10). | ✅ Fully addressed. |

**Score: 5/7 fully addressed, 2/7 partially addressed (both acceptable for Phase 1).**

### NEW-3: Guard loading error handling (NEW — LOW)

The design specifies auto-discovery: scan `agents/shared/guards/*.ts` and `agents/<name>/guards/*.ts`, import each file, expect `export const guard: WorkflowGuard`. 

What happens when:
- A guard file has a syntax error? → Should log error and skip, not crash the workflow.
- A guard file exports something other than `WorkflowGuard`? → Should validate shape and skip.
- A guard's `handle()` throws? → Should catch, log, and treat as empty demands (not crash workflow).

The design's example guards show the export convention but doesn't specify error handling during loading or execution. This is an implementation concern — the pattern is clear (defensive loading with logging), and it matches how workflow auto-discovery already works.

**Recommendation:** `loadGuards()` should wrap each import in try/catch, validate the exported object shape, and log any failures. Guard `handle()` calls should be wrapped in try/catch with the guard name in the error log. This is standard defensive coding — not a design change.

---

## Comparison: v1 Review Concerns vs v2 Architectural Decisions

The v2 design made two architectural pivots that eliminated multiple concerns:

**Pivot 1: Auto-discovery instead of registration.**  
This eliminated: guard deduplication concern (#5), agent.json maintenance burden, workflow-code wiring complexity. The directory-convention approach is simpler and proven (workflows already use it).

**Pivot 2: `source` field on events instead of string-prefix conventions.**  
This eliminated: my concern about unreliable step-type detection. Guards can now check `event.source === "function"` instead of parsing step names. The `guard:` prefix remains as a *convention* for human readability, but the `source` field is the machine-reliable discriminator.

Both pivots are improvements over the v1 design I reviewed.

---

## Items Confirmed Working As-Designed

These areas I scrutinized and found correct:

1. **Block-first demand resolution** — Blocks collected from all guards before any run_step executes. Multiple block reasons concatenated. Correct.
2. **Warning delivery** — Appended to next step's task as `## Guard Warnings` section. Simple, visible, no runtime changes. Correct.
3. **`runFunction()` error handling** — 30s timeout, 50KB truncation, error-as-TaskResult. Thorough.
4. **`WorkflowBlocked` error type** — Caught by `runOrResume()` like `WorkflowInterrupted`. Clean integration.
5. **`beforeToolCall` coexistence** — Two guard layers at different granularities (tool-call vs step-level). No conflict. Future convergence correctly deferred to Phase 3+.
6. **Phase 1 scope** — Types + discovery + demand resolution + `runFunction()` + auto-test guard + 8 unit tests. This is a well-scoped first phase.

---

## Final Assessment

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Architecture | ✅ Strong | Event-listener model, pure-function guards, demand types — all sound |
| Cost protection | ✅ Adequate | Three-tier migration + `maxInjectedSteps` + DB tagging |
| Risk management | ✅ Good | Heartbeat deferred, phased rollout, escape hatches |
| Implementation readiness | ✅ Ready | Types specified, integration points identified, tests enumerated |
| Previous concerns addressed | ✅ 5/7 fully, 2/7 partially (acceptable) | See audit table above |

**Overall: APPROVE for Phase 1 implementation. No design changes required.**

Minor items for implementation awareness (not design-blocking):
- Add `agent` field to guard events (v1 concern #2 — partially addressed)
- Structured demand persistence (v1 concern #6 — Phase 2)
- Guard load/execute error handling (NEW-3)
- Explicit "intentional quality investment" cost statement for guard-injected steps

---

*This review confirms the v2 design is ready for coding. The three-tier migration properly protects zero-LLM handlers, the cost tracking mechanism is sound for Phase 1, and no new architectural concerns were found beyond the three minor items noted above.*
