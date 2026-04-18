# Cleanup: Workflow Dead Weight

**Date**: 2026-04-11  
**Source**: audit-workflow-execution-path.md (Lens B findings)  
**Session**: s_1775924657707_1513

---

## Actions Taken

### 1. Deleted archive directory ✅
- **Path**: `agents/may/workflows/archive/` (2 files, 111 lines)
- **Files removed**: `xhs-research-69abc023.ts`, `paper-review-2601-12538.ts`
- **Verification**: No imports/references from any active code. `listWorkflowFiles()` uses `readdirSync` (top-level only), so archive/ was already excluded from loading.
- **Risk**: Zero. One-off research workflows preserved in git history.

### 2. Cleaned orphaned workflow JSON files ✅
- **Path**: `.state/workflows/wr_*.json`
- **Before**: 295 files, 5.3MB
- **After**: 28 files (kept last 24h for in-flight workflows)
- **267 files deleted** (older than 24 hours)
- **Why safe**: These JSON files are written by `saveWorkflowRun()` for resume capability. Old runs will never be resumed. Active/recent runs kept intact.

### 3. fewshot-inject rename — already done ✅
- **Finding**: Audit said `fewshot-inject.ts` should be renamed to avoid spurious workflow load errors.
- **Current state**: Already renamed to `fewshot-inject-helpers.ts` — matches the `-helpers` exclusion pattern in `listWorkflowFiles()`. No action needed.

## Items Deferred (P2/P3)

### 4. workflow-defs.d.ts type duplication — deferred
- **Location**: `src/lib/workflow-defs.d.ts` (94 lines)
- **Issue**: Duplicates types from `workflow.ts`, `types.ts`, and `handoff.ts`. 19 workflow files use `/// <reference path>` to get ambient types instead of proper imports.
- **Additional finding**: 9 of 19 files reference `src/workflow-defs.d.ts` (wrong path — file is at `src/lib/workflow-defs.d.ts`). They still work because TSC doesn't resolve broken reference paths as errors for ambient .d.ts files.
- **Why deferred**: Eliminating this requires converting all 19 workflow files from `/// <reference>` to proper `import type {}` statements. Medium-risk refactor touching many agent-owned files.
- **Recommendation**: Do this when touching individual workflows for other reasons.

### 5. saveWorkflowRun disk persistence — deferred
- **Issue**: `saveWorkflowRun()` called at 5 points in workflow-tool.ts. Writes JSON files that overlap 90% with session meta.json + SQLite.
- **Why deferred**: `readWorkflowRun()` is actively used by the `resume` action (line 530). Removing disk writes would break resume or require rewriting it to reconstruct from session DB.
- **Mitigation applied**: Periodic cleanup of old files (done in item #2 above). Can automate via cron if files accumulate again.

### 6. Resume replay logic simplification — deferred
- **Issue**: 70 lines of replay logic for crash recovery that rarely fires.
- **Why deferred**: Low impact, code is isolated and correct.

## Results

| Metric | Before | After |
|--------|--------|-------|
| Archive dead code files | 2 | 0 |
| Archive dead code lines | 111 | 0 |
| Orphaned workflow JSONs | 295 | 28 |
| Disk space freed | ~5MB | - |
| TSC status | ✅ pass | ✅ pass |

## Remaining P2 work
- Eliminate `workflow-defs.d.ts` → proper imports in 19 workflow files
- Fix 9 broken `/// <reference path>` paths (wrong relative path)
- Consider auto-cleanup of `.state/workflows/` in cron (purge files older than 7 days)
