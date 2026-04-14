# Design Review: Guards as Workflow Demands + Cron-to-Workflow Migration

**Reviewer:** Bob (Architect)  
**Document:** agents/may/workspace/DESIGN-guards-v2.md  
**Date:** 2026-04-14  
**Request:** req:40835dd7  

---

## Overall Assessment: APPROVE WITH CHANGES

This is a strong design. The core insight — guards as event listeners returning demands, not imperative hooks — is the right abstraction. It cleanly separates observation (guards inspect events) from execution (runtime processes demands), which avoids the mutation/side-effect problems that plague `beforeToolCall` hooks. The `runFunction()` primitive is long overdue and well-motivated by verify-wrap's evolution.

However, there are issues with scope, some under-specified edges, and a tension with our existing design philosophy that needs explicit reconciliation. I'd approve this for Phase 1 implementation with the changes below.

---

## Part-by-Part Review

### Part 1: The Demand Model — ✅ Strong

**What works:**
- Three demand types (block/warn/run_step) cover the right space. I tried to think of a fourth and couldn't. `block` = hard stop, `warn` = soft signal, `run_step` = inject action. These map cleanly to the actual things you'd want a guard to do.
- Pure-function constraint is realistic AND desirable. Guards inspect `WorkflowGuardEvent` data and return `Demand[]` — no tool calls, no state mutation, no async. This keeps them testable, fast, and predictable.
- The event types are right: `step_done` (most common trigger), `step_start` (pre-flight checks), `workflow_start` (setup), `workflow_done` (cleanup/reporting).

**One concern:** The `step_done` event passes `result: TaskResult` which contains the full `messages[]` array. Guards doing deep inspection of message content (like extracting changed files) are doing non-trivial work in a "pure function." This is fine architecturally but:

> **Change 1:** Document explicitly that guards MAY do compute-heavy inspection of TaskResult (regex scanning, file list extraction) but MUST NOT do I/O (no fs reads, no DB queries, no network). The "pure" constraint is about side-effects, not computational cost.

### Part 2: Workflow Runtime Changes — ✅ Good, needs edge case work

The implementation sketch is clean and slots naturally into the existing `executeWorkflow()` flow. The demand resolution order (blocks → run_steps → warns) is correct.

**Issues:**

1. **`injectionDepth` reset timing.** The proposal resets `injectionDepth = 0` before the next planned step. But what if a guard produces a `run_step` demand from a `step_start` event? The `step_start` → guard → `run_step` → `step_done` → guard chain would also need depth tracking. The reset should happen at the top of each **planned** step cycle, not just after `resolveDemands`.

> **Change 2:** Reset `injectionDepth` at the start of each planned step iteration, not after `resolveDemands`. This is actually what the code shows but the prose is ambiguous.

2. **Warning delivery mechanism.** The proposal says warnings are "collected and passed to next step's context" but doesn't specify HOW. The `runAgent()` call takes a task string — are warnings appended to the task? Injected as a system message? This matters for whether agents actually see them.

> **Change 3:** Specify that warnings are appended to the next step's task string as a `## Guard Warnings` section. Simple, visible, no runtime changes beyond string concatenation. Example:
> ```
> [original task]
> 
> ## Guard Warnings
> - Consider adding error handling (from: guard-name)
> ```

3. **Demand deduplication.** If guard A returns `run_step("auto-test")` and guard B also returns `run_step("auto-test")` on the same event, do we run tests twice? Probably not.

> **Change 4:** Deduplicate `run_step` demands by step label before execution. If two guards demand the same labeled step, run it once.

### Part 3: Guard Registration — ✅ Clean

Three sources (agent.json, workflow code, dynamic-future) make sense. The ordering is logical.

**One note:** The agent.json `guards` field resolves to `agents/<name>/guards/` or `agents/shared/guards/`. This is a file-based lookup at workflow start time, which means guard code needs to be loadable as modules. The proposal doesn't show the file format.

> **Change 5:** Show the guard module format. Suggestion: each guard file exports a `WorkflowGuard` object as default export, following the same pattern as workflow modules. E.g., `agents/shared/guards/auto-test.ts` exports `{ name, events, handle }`.

### Part 4: Loop Protection — ⚠️ Adequate but brittle

`MAX_INJECTION_DEPTH=3` plus step-label awareness is a reasonable starting point. But:

1. **Depth=3 might be too generous.** In practice, an injected step that triggers another injected step that triggers another is already concerning. The expected pattern is depth=1 (guard injects step, step completes, continue). Depth=2 is unusual. Depth=3 means something is probably wrong.

> **Recommendation:** Start with `MAX_INJECTION_DEPTH=2` and log a warning at depth=2. If we find legitimate depth=3 cases, increase it with evidence.

2. **The label-based de-looping in the example is a convention, not an enforcement.** If a guard author forgets to check `event.step.startsWith("guard:")`, the depth limit is the only safety net.

> **Change 6:** The runtime should enforce that guard-injected steps have labels starting with `guard:` (prefix the label automatically if not already present). This makes the convention structural.

### Part 5: Example Guards — ✅ Good illustrations

The auto-test, verify-files, and no-secret-leak examples are well-chosen and demonstrate all three demand types.

**Observation:** `extractChangedFiles(event.result)` and `extractWrittenFiles(event.result)` are doing the same work that `verify-wrap.ts` already does (see its `extractWrittenFiles` function, lines 35-88). This SHOULD be a shared utility.

> **Change 7:** Extract the file-extraction logic from verify-wrap.ts into a shared utility (e.g., `src/lib/workflow-utils.ts`). Guards and workflows both need it.

### Part 6: Cron-to-Workflow Migration — ⚠️ Right direction, wrong scope for this design

This is where I have the most feedback. The cron migration is a great idea but it's a SEPARATE initiative from the guard system. Including it here:
- Doubles the implementation scope
- Mixes two independent concerns (guard demand model + cron architecture)
- Creates a dependency chain (Phase 3 depends on Phase 1+2, which means delays in guards block heartbeat migration)

**The `runFunction()` primitive is the connective tissue** — it's needed by both guards and cron migration. So Phase 1 should include `runFunction()`, but the heartbeat migration should be its own design doc with its own phasing.

> **Change 8:** Split the cron migration into a separate design doc. Keep `runFunction()` in this design (it's useful for guards too — e.g., a guard could demand a function step). Move Parts 6 and Phase 3-4 to `DESIGN-cron-workflow-migration.md`.

**That said, the technical content is sound:**

- The sensor→judge pattern is correct. JS collects data, LLM decides. This matches our finding that judgment requires LLM (KE-021) while data collection doesn't.
- The migration categories are well-reasoned. DB sync and operational cleanup staying as JS handlers is exactly right — those are R < 0.1 tasks.
- The heartbeat workflow sketch is clean. `runFunction("gather-context")` replacing the 170-line `fireHeartbeat()` is a significant simplification.
- The error-scan example nicely shows the "zero LLM cost when nothing found" pattern.

**One concern with the heartbeat migration:** The current `fireHeartbeat()` has accumulated significant complexity (auto-pause probes, tiered budgets, orphan injection, request tracking). A workflow version needs to handle all of this or we lose functionality. The design sketches a clean version but doesn't address the messy reality.

> **Change 9:** When the cron migration design is written, it must include a migration checklist mapping every feature of current `fireHeartbeat()` to its workflow equivalent. Don't hand-wave the 170 lines — enumerate them.

### Part 7: Summary Table — ✅ Accurate

The "what does NOT change" section is important and correct. Explicitly noting that `beforeToolCall` hooks continue unchanged avoids confusion about the two guard systems coexisting.

### Part 8: Implementation Plan — ⚠️ Needs adjustment per scope split

If cron migration is split out, the phases simplify to:
- **Phase 1:** Core demand system + `runFunction()` + one guard on one workflow (2-3 days)
- **Phase 2:** Guard library + agent.json registration + verify-wrap migration (2-3 days)

Phase 1 is the right test: ship auto-test or verify-files on implement-and-review, validate the demand model works, then expand.

---

## Reconciliation with code-vs-data-decisions.md

The existing design philosophy doc (`agents/shared/may-agent-docs/design/code-vs-data-decisions.md`) explicitly warns against guards:

> "Guards hardcode assumptions into regexes... When the environment changes: find the regex, edit code, rebuild image"

This design needs to address why workflow-level guards are different from the `beforeToolCall` guards that doc criticizes. The answer is clear but unstated:

1. **Workflow guards operate on structured events**, not raw text. They inspect `TaskResult` objects, not regex-matching agent output.
2. **Workflow guards are opt-in** (agent.json + workflow code), not universal.
3. **Workflow guards produce demands** (which the runtime processes), not mutations (which change agent behavior invisibly).
4. **The failure mode is different**: a bad `beforeToolCall` guard silently blocks a tool call; a bad workflow guard produces a visible demand that shows up in the workflow trace.

> **Change 10:** Add a section explicitly reconciling this design with code-vs-data-decisions.md. Explain why these guards don't have the problems that doc identifies. Update code-vs-data-decisions.md to distinguish between "session-level guards (fragile, avoid)" and "workflow-level guards (structured, use for process enforcement)."

---

## Open Questions — My Recommendations

### Q1: Guard ordering

**Recommendation: Blocks always win, regardless of order.**

The proposal already suggests this and it's correct. Scan all guards, collect all demands, then process. If any demand is a `block`, halt immediately — don't execute any `run_step` demands first. This is the simplest model and prevents a situation where a run_step executes before a block from a later guard would have caught a problem.

Implementation: `resolveDemands` already does this (blocks check is first). Just document that guard evaluation order doesn't matter for correctness.

### Q2: Injected step failures

**Recommendation: Option (c) — let guards decide.**

This is the most compositional answer. The auto-test guard's injected test step completes → emits `step_done` → guards react. The auto-test guard itself can check: "was this my test step, and did it fail?" → return `block`. This keeps the decision logic in the guard, not in the runtime.

One nuance: the runtime should ensure the injected step's `result.status` is clearly visible in the event. Don't hide failure information.

### Q3: `runFunction()` and guards

**Recommendation: Events fire, all demand types processed.**

I disagree with the proposal's suggestion to skip `run_step` demands from function step events. A function step that discovers a problem (e.g., scan-errors finds critical patterns) might legitimately trigger a guard that demands an immediate step. Artificially restricting demand types from function events adds complexity without clear benefit.

The loop protection (depth limit + label dedup) is sufficient to prevent runaway chains. If we find a real problem, restrict then.

---

## Alignment with Research Findings

This design aligns well with our empirical knowledge:

- **KE-021 (Process > Knowledge > Judgment):** Guards are process enforcement — they add steps, not instructions. This is the highest-effectiveness category. Auto-test guard = "run tests after code changes" = process skill delivered structurally.

- **KE-015 (Decision Topology):** Guards are appropriate for high-R tasks (verification, testing, file checks — all eliminable decisions). The design correctly scopes guards to workflows only, avoiding the R < 0.3 territory where structure hurts.

- **The verify-wrap precedent:** The existing verify-wrap workflow already does exactly what auto-test and verify-files guards would do, but baked into a specific workflow. Guards generalize this pattern to any workflow. This is a natural evolution.

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Guards add latency to every workflow step | Medium | Guards are sync pure functions — should be <1ms. Monitor. |
| Guard-injected steps are expensive (LLM cost) | Medium | Guards should prefer `warn` over `run_step` when possible. Track guard-injected step cost separately. |
| Two guard systems confuse developers | High | Add clear docs: `beforeToolCall` = session-level tool hooks, workflow guards = step-level event listeners. Different layers, different purposes. |
| Scope creep into cron migration | High | Split the design doc (Change 8). Ship guards first. |

---

## Summary of Required Changes

1. Document that guards MUST NOT do I/O (clarify "pure" constraint)
2. Clarify `injectionDepth` reset timing
3. Specify warning delivery mechanism (append to task string)
4. Add `run_step` demand deduplication by label
5. Define guard module file format
6. Auto-prefix `guard:` on injected step labels
7. Extract shared file-extraction utility from verify-wrap
8. **Split cron migration into separate design doc** (biggest structural change)
9. Cron migration doc must include `fireHeartbeat()` feature migration checklist
10. Reconcile with code-vs-data-decisions.md explicitly

Changes 1-7 are small and can be addressed in a revision pass. Change 8 is a scoping decision. Changes 9-10 are documentation tasks.

---

**Verdict:** Good design, right abstractions, needs scoping discipline. Ship Phase 1 (demand model + one guard) quickly and validate before expanding.


[SIG: review-guards-v2:bob:2026-04-14]
