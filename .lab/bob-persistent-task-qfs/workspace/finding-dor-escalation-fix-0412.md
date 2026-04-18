# Finding: D-o-R False Escalation Fix — Root Cause & Resolution

**Date**: 2026-04-12T06:00 UTC  
**Author**: Tech Lead  
**Status**: IMPLEMENTED  
**Impact**: 22 of 23 false escalations fixed (95.7%)

## Problem

The deliver-or-report (D-o-R) workflow has a **59% false escalation rate** — 23 of 39 runs escalate with "Non-delivery detected: Phase 2 completed but no deliverable files found on disk". ALL 23 escalations have this identical reason.

Investigation reveals that in most cases, Phase 2 **DID write the deliverables** but the workflow's file detection couldn't find them.

## Root Cause

The Phase 3 verification builds its file list from two sources:

```typescript
const allMentionedFiles = [
  ...plannedFiles,                    // From Phase 1 assistant text (regex)
  ...extractFilePaths(phase2Text),    // From Phase 2 lastAssistantText (regex)
];
```

**Both sources fail for the same reason:** `lastAssistantText` is the agent's final message before session end, which is typically a brief verification summary like:

- "All verified ✅"  
- "Both deliverables verified on disk: 1. INDEX.md — CR-339 row at line 707 ✅"
- "All my changes are committed. All deliverables verified."

These summaries don't contain **full file paths** (e.g., `agents/shared/knowledge/hypotheses/H-105.md`). `extractFilePaths()` requires paths with `/` and length > 3, so short references like "INDEX.md" or "KE-101" produce zero matches.

Meanwhile, the actual file paths ARE available in:
1. **`phase2.messages`** — contains the actual `write()`/`edit()` tool calls with full paths
2. **`phase2.finishResult.deliverables`** — structured `finish()` data with explicit paths

Neither was being used.

## Fix Applied

In `agents/bob/workflows/deliver-or-report.ts`:

### Change 1: Capture Phase 2 session data (lines 224-225)
Added `phase2Messages` and `phase2FinishDeliverables` variables to capture Phase 2's messages and structured finish deliverables.

### Change 2: Populate in both code paths (lines 266-267, 303-304)
Both the "narrow path" (some files already exist) and "normal path" (full Phase 2) now capture:
- `phase2Messages = phase2.messages ?? []`
- `phase2FinishDeliverables = (phase2.finishResult?.deliverables ?? []).map(d => d.path)`

### Change 3: Use all sources in Phase 3 (lines 317-329)
```typescript
const allMentionedFiles = [
  ...plannedFiles,
  ...extractFilePaths(phase2Text),
  ...extractWrittenFilePaths(phase2Messages),   // NEW: actual write/edit tool calls
  ...phase2FinishDeliverables,                   // NEW: structured finish() paths
];
```

### Change 4: Handle "already done" tasks (lines 484-510)
If uniqueFiles is empty but Phase 2's finish() reported success, mark as `done` (pre-existing) instead of escalating. This covers the 1 remaining case where the task's deliverables already existed.

## Validation

Tested against all 23 escalated workflow runs:
- **22/23 (95.7%)**: Would have been correctly identified as delivered via `extractWrittenFilePaths(messages)` and/or `finishResult.deliverables`
- **1/23 (4.3%)**: "Already done" case — task deliverables pre-existed, no writes needed. Now handled by the Phase 2 finish status check.

**Expected new escalation rate**: ~0% for this specific failure mode.

## Example

Escalated run `wr_1775971453992_iwpq` (H-105 hypothesis):
- Phase 2 wrote: `agents/shared/knowledge/hypotheses/H-105.md`
- Phase 2 `finish(deliverables: [{path: "agents/shared/knowledge/hypotheses/H-105.md"}])`
- Phase 2 `lastAssistantText`: "All verified: 124 lines, 8 major sections..."
- **Before fix**: `extractFilePaths(lastAssistantText)` → `[]` → ESCALATED
- **After fix**: `extractWrittenFilePaths(messages)` → `["agents/shared/knowledge/hypotheses/H-105.md"]` → DONE
