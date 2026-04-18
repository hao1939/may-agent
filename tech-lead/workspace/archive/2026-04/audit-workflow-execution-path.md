# Audit: Workflow Execution Path Complexity

**Date**: 2026-04-11  
**Lens**: B (Flow Complexity)  
**Target**: `workflow.run()` → agent work — how many layers, how much overhead?

---

## 1. Layer Map: workflow.run() to Actual Agent Work

When an agent calls `workflow.run('implement-and-verify', task)`, here's every layer the call passes through:

```
Layer 1: Agent's tool call → workflow tool execute()          [workflow-tool.ts:514]
Layer 2: execute() → findWorkflow() + runOrResume()           [workflow-tool.ts:389]
Layer 3: runOrResume() → executeWorkflow()                    [workflow-tool.ts:197]
Layer 4: executeWorkflow() → ctx.runAgent() (in workflow def) [workflow-tool.ts:231]
Layer 5: ctx.runAgent() → manager.callAgent()                 [workflow-tool.ts:280]
Layer 6: callAgent() → this.run()                             [manager.ts:2251]
Layer 7: run() → creates Agent, builds context, starts loop   [manager.ts:877]
Layer 8: runAgentWithRetry() wraps the agent loop              [manager-retry.ts:265]
```

**8 layers** from tool invocation to agent work starting. Compare to `agents.call()`:

```
Layer 1: Agent's tool call → agents tool execute()
Layer 2: execute() → manager.callAgent()                      [manager.ts:2251]
Layer 3: callAgent() → this.run()                             [manager.ts:2297]
Layer 4: run() → creates Agent, builds context, starts loop   [manager.ts:877]
Layer 5: runAgentWithRetry() wraps the agent loop              [manager-retry.ts:265]
```

**5 layers.** The workflow wrapper adds 3 extra layers.

## 2. Persistence Writes Per Workflow Step

Each `ctx.runAgent()` call triggers this cascade of writes:

### On session start (manager.run):
1. `mkdirSync` — create session directory
2. `mkdirSync` — create output subdirectory
3. `writeFileSync` — [STARTED] sentinel file
4. `writeSessionMeta` — meta.json (atomic: .tmp → rename)
5. `readSessionMeta` — read back existing meta for merge
6. `writeSessionMeta` — merged meta.json (atomic: .tmp → rename) 
7. EventBus → `DbWriter.upsertSession()` — SQLite INSERT/UPDATE
8. EventBus → `ActivityWriter` — activity tracking

### During agent execution:
9. N× `appendSessionMessage` — JSONL appends per message (typically 5-20 per session)

### On completion (handleCompletion):
10. `writeSessionMeta` — status update (atomic: .tmp → rename)
11. EventBus → `DbWriter.updateSessionDb()` — SQLite UPDATE  
12. `upsertDigest` — session digest SQLite INSERT/UPDATE
13. Session compaction if needed — `saveCompactedMessages`

### Workflow-level:
14. `saveWorkflowRun` — JSON file write (atomic: .tmp → rename) — **once per step**

**Total: ~14 I/O operations per workflow step**, plus N message appends.

For `implement-and-verify` (best case: 1 coder attempt, verify passes):
- 1 coder session = ~14 I/O ops + message appends
- Plus 1 `execSync` for verification
- Plus 1 `saveWorkflowRun` at workflow end
- **Total: ~15 file/DB operations minimum**

For `implement-and-review` (best case: coder + QA pass):
- 2 agent sessions × ~14 = ~28 I/O ops
- Worst case (coder retry + QA fail + fix + re-review): 5 sessions × ~14 = ~70 I/O ops

## 3. What the Workflow Wrapper Actually Adds

### Value-add (genuine):
1. **Retry loop** (`implement-and-verify`): Shell verification → retry with error context. This is the #1 value. Without it, agents claim "tests pass" when they don't (FM-3.3).
2. **Step resumption** (`resume` action): Can replay completed steps from archived session data on crash recovery. Saves re-running expensive LLM calls.
3. **Steering** (interruption queue): Parent can inject steering messages between steps. Used but rare.
4. **Composition** (`ctx.runWorkflow`): Workflows can nest. Max depth 3. Used by `deliver-or-report`.
5. **Observability**: Step-level events, step summaries in the result, workflow run JSON files on disk.

### Overhead that doesn't earn its keep:
1. **WorkflowRun JSON persistence** (293 files on disk): Written per-step AND per-workflow. The data overlaps 90% with session meta.json + SQLite. Nobody queries these files programmatically — they're only useful for manual debugging.
2. **Replay logic** (lines 191-260 in workflow-tool.ts): 70 lines of code for replaying archived steps on resume. In practice, `resume` is called after process crashes, but crashed workflows almost always need re-execution anyway because external state has changed. The replay logic adds complexity for a rarely-exercised optimization.
3. **Double steering check** (before AND after each runAgent): Lines 215 + 260 — checks steering queue before spawning the agent AND again after the agent completes. This creates a subtle timing race: a steering signal arriving mid-execution won't interrupt the running agent, it waits for completion then throws. The "interrupt" is really "gate the next step."
4. **Type duplication** (workflow-defs.d.ts): 90 lines duplicating types from workflow.ts. This exists so workflow .ts files can use `/// <reference path>` instead of imports. Fragile — types must be manually kept in sync.

## 4. Retry/Loop Logic Assessment

### implement-and-verify (clear):
```
for attempt 1..maxAttempts:
  coder runs (with retry on error if attempt==1)
  shell verify
  if pass → done
  if fail → record output, continue
escalate
```
Simple, readable, correct. The one oddity: coder gets a retry on `status === "error"` only on the first attempt, not subsequent ones. This is intentional (keep overhead low) but not obvious.

### implement-and-review (tangled):
```
coder runs (with retry on error)
QA reviews
  → PASS/CONDITIONAL → done
  → critical rejection keywords → escalate
  → other FAIL → fix loop:
    coder fixes (with retry on error)
    QA re-reviews
      → FAIL → escalate
      → PASS/CONDITIONAL → done
```
The verdict extraction (`getVerdict()`) is doing too much — pattern matching on markdown output with fallback heuristics. The "default to conditional pass" is a workaround for QA being ambiguous. This is fragile but functional.

### parallel-research (clean):
Fork-join with `Promise.allSettled`. Clean, no retry logic. Synthesis step is degraded-graceful (returns thread results even if synthesis fails).

## 5. Workflow Inventory (Updated 2026-04-11)

**Archive directory**: Already deleted (earlier cleanup). ✅

**6 shared workflows** in `agents/shared/workflows/` totaling 1,106 lines:
- `implement-and-verify.ts` (201 lines) — core coder+verify loop
- `implement-and-review.ts` (163 lines) — coder+QA review loop
- `parallel-research.ts` (184 lines) — fork-join research pattern
- `skill-lifecycle.ts` (246 lines) — skill management
- `verify-wrap.ts` (153 lines) — optimizer-specific verify wrapper
- `fewshot-inject-helpers.ts` (159 lines) — helper (already renamed from fewshot-inject.ts) ✅

**15 agent-specific workflows** totaling 3,054 lines:
- optimizer: safe-edit (291), design-review (119), enhance-cron (351)
- bob: deliver-or-report (472)
- coach: growth-cycle (318), training-sprint (301), gym-helpers (348), verify-setup (42), convention-review (50)
- tech-lead: verified-coder (176)
- may: test-and-fix (45), design-then-build (94), project-monitor (97), research-pipeline (84)
- qa: vet-skill (266)

**Total**: 21 workflow files, 4,160 lines. Plus 89 `wr_*.json` persistence files on disk (down from earlier 293).

## 6. Findings Summary

### Finding 1: Workflow persistence is triply redundant
Each workflow step creates:
- `meta.json` per session (source of truth)
- SQLite row per session (queryable index)
- `wr_*.json` per workflow run (293 files, never queried programmatically)

The workflow run JSON files duplicate session metadata. They add value only for "which sessions belong to which workflow" — but that's already tracked via `workflowRunId` in session meta.json and the sessions SQLite table.

**Proposal**: Remove `saveWorkflowRun` persistence. Keep the in-memory `WorkflowRun` for the `resume` action, but don't write 89+ JSON files nobody reads.

### Finding 2: The workflow wrapper is well-designed but has unnecessary resume complexity
The `resume` action with replay logic (70 lines) handles a narrow case: process crash mid-workflow where you want to skip already-completed steps. But workflows complete in minutes, crashes are rare, and external state changes during the crash window make replay unreliable. The `resume` action could be simplified to "re-run the workflow from scratch" — which is what usually happens anyway.

### Finding 3: Type duplication between workflow.ts and workflow-defs.d.ts is a maintenance hazard
Both files define `WorkflowContext`, `WorkflowResult`, `WorkflowEvent`, `HandoffOptions`, `TaskResult`. Changes to one must be manually propagated to the other. This should be eliminated — workflow files should import types directly.

### Finding 4: Archive directory already cleaned ✅
Previously 3,480 lines of archived workflows. **Already deleted** in prior cleanup.

### Finding 5: fewshot-inject already renamed ✅
Previously named `fewshot-inject.ts` (confusing — looked like a workflow but was a helper). **Already renamed** to `fewshot-inject-helpers.ts`.

### Finding 6: verify-wrap hardcodes "optimizer" as the executor
`verify-wrap.ts` always runs Phase 1 with `ctx.runAgent("optimizer", ...)`. If another agent wants to use verify-wrap, it can't specify which agent does the work. This makes it a verify-wrap-for-optimizer, not a general-purpose wrapper.

## 7. Recommended Simplifications

| Priority | Change | Lines saved | Risk |
|----------|--------|-------------|------|
| ~~**P1**~~ | ~~Delete `agents/shared/workflows/archive/`~~ | ~~-3,480~~ | ✅ Already done |
| ~~**P1**~~ | ~~Rename `fewshot-inject.ts` to `fewshot-inject-helpers.ts`~~ | ~~0~~ | ✅ Already done |
| **P2** | Remove `saveWorkflowRun` disk persistence, keep in-memory only | -50 lines, -89+ files | Low (resume action can re-run from scratch) |
| **P2** | Eliminate `workflow-defs.d.ts` — have workflow files import from `../../src/lib/workflow.ts` | -90 | Medium (need to update reference paths in all workflows) |
| **P3** | Simplify resume to "re-run" (remove replay logic) | -70 | Low (replay rarely exercised) |
| **P3** | Make verify-wrap accept agent name as parameter | ~+5 lines | Low |

**Remaining simplification potential**: ~210 lines removed, 89 orphaned JSON files cleaned up.
**Already completed**: ~3,480 lines removed (archive dir + rename).
