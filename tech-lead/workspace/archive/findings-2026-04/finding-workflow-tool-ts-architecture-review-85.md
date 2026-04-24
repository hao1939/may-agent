# Finding: workflow-tool.ts Architecture Review (859 LOC)

**File**: `src/lib/workflow-tool.ts`
**Date**: 2026-04-16
**Severity**: Low (well-structured, minor concerns)

## Summary

The file is a well-organized workflow orchestration tool that handles list/run/resume actions, guard system integration, step replay for resume, and steering interrupts. Despite 859 LOC, responsibilities are coherent and the code reads linearly. No god-function pattern — `executeWorkflow` is large (~250 lines) but justifiably so as it builds the `WorkflowContext` object with multiple closures.

## Architecture

1. **Tool schema** (lines 1-60): Parameter definitions, types
2. **Helpers** (lines 62-130): `textResult`, `truncate`, `generateRunId`, `buildStepSummaries`, `loadWorkflow`, `listWorkflowFiles`, `findWorkflow`
3. **Guard system** (lines 132-230): `loadGuards`, `emitAndCollectDemands`, `resolveDemands`
4. **Core execution** (lines 260-580): `executeWorkflow` — builds `WorkflowContext`, manages replay vs live execution, guard lifecycle
5. **Run/resume wrapper** (lines 580-680): `runOrResume` — shared entry for run+resume, maps results to tool responses
6. **Tool object** (lines 680-860): The actual `WorkflowTool` with `execute`, `steer`, `isRunning`

## Findings

### F1: `resolveDemands` has 12 parameters (Medium)
**Evidence**: Lines ~170-185. The function signature takes 12 positional arguments — a classic sign of a missing context/config object.
**Recommendation**: Bundle into a `ResolveContext` object. Low-risk refactor.

### F2: `runAgent` closure duplicates step recording logic (Low)
**Evidence**: Lines ~300-400 (replay path) and ~400-470 (live path) both construct `CompletedStep` + `WorkflowStep`, push to arrays, persist, emit events. ~30 lines duplicated.
**Recommendation**: Extract a `recordStep()` helper. Not urgent.

### F3: Guard warning injection is side-effectful and fragile (Low)
**Evidence**: Lines ~430-435. `guardWarnings` are appended to the next agent's task string then cleared (`guardWarnings.length = 0`). If no agent runs after warnings accumulate, they're silently lost.
**Recommendation**: Ensure warnings are captured in the final workflow result even if no subsequent step runs.

### F4: `importCounter` cache-busting via query string (Info)
**Evidence**: Line 63, used at lines ~90 and ~155. Dynamic imports use `?t=N` to bust module cache. This is a pragmatic workaround for hot-reload but means every `list` action re-imports all workflow files.
**Recommendation**: Acceptable trade-off for dev environment. No action needed.

### F5: No issues with action dispatch (Good)
The `execute` switch on `params.action` (lines 700-860) is clean — each case validates params, delegates to helpers, returns. No overlapping responsibilities with workflow engine — this file is the *bridge* between the agent tool interface and `workflow.ts` types.

## Overall Assessment

**Architecture quality: Good.** The file has one clear job: adapt the workflow engine for use as an agent tool. The guard system adds complexity but is well-contained. The resume/replay logic is the most complex part but handles edge cases thoughtfully (agent name mismatch detection, archived data unavailability fallback).

**No urgent action needed.** F1 (12-param function) is the most worthwhile cleanup if someone's in the area.
