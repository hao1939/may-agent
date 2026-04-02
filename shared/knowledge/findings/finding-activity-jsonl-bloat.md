# Finding: activity.jsonl Unbounded Growth — 27MB Across 13 Agents

**Date**: 2026-03-23T09:20:00Z
**Severity**: Medium — disk waste + context waste when LLMs read the file

## Problem

`agents/*/workspace/activity.jsonl` files grow without bound. No trimming mechanism existed. After ~8 days:

| Agent | Size | Lines |
|---|---|---|
| evaluator | 7.0MB | 1,491 |
| coach | 4.0MB | 5,607 |
| may | 3.9MB | 4,990 |
| tech-lead | 3.3MB | 4,645 |
| bob | 2.6MB | 3,297 |
| scout | 1.5MB | 2,079 |
| **Total** | **27MB** | **~25,000** |

### Root Causes

1. **No trimming**: `appendActivity()` was append-only with no size check
2. **Evaluator task messages**: Start events logged full evaluation task text (366KB per line!) because `task` field wasn't truncated
3. **workspace-compaction protected it**: Activity.jsonl was in the protected list, so even periodic cleanup wouldn't touch it

## Fix Applied (2 changes, 1 file each)

### 1. Auto-trim on session start — `src/lib/activity.ts`
- Added `trimActivityFile()` function: checks file size, keeps last 1000 lines
- Called only on `"start"` events (once per session, not every append)
- Threshold: 500KB (~7 days of history for most agents)
- Best-effort: never throws, never breaks session lifecycle

### 2. Truncate task field — `src/lib/manager.ts`  
- Changed: `task` → `truncateSummary(task, 500)` in the start event
- Prevents evaluator's 366KB task messages from bloating the log
- Full task is still in session.jsonl for forensics

### Immediate cleanup
- Trimmed all files to 1000 lines
- Truncated evaluator's oversized entries inline
- **Saved: ~14MB immediately** (27MB → 13.3MB, will settle to ~6MB)

## Tests

- 21/21 tests pass (18 existing + 3 new trimming tests)
- Test: trim triggers on start event, keeps last 1000 lines
- Test: no trim on small files
- Test: no trim on non-start events

## Impact

| Metric | Before | After |
|---|---|---|
| Total activity.jsonl | 27MB (growing ~3.5MB/day) | Capped at ~6.5MB (500KB × 13 agents) |
| Evaluator single line | Up to 366KB | Capped at ~600 bytes |
| Disk growth rate | Unbounded | Self-limiting |
