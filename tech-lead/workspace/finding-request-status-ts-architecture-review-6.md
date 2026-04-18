# Finding: request-status.ts Architecture Review

**File**: `src/lib/tools/request-status.ts` (690 LOC)
**Date**: 2026-04-16
**Severity**: Low-Medium (no bugs, but growing complexity)

## Summary

`request-status.ts` is a CLI status dashboard renderer. It's a **read-only presentation layer** that aggregates data from multiple sources (DB, JSONL files, JSON files) into a formatted text dashboard. Architecturally it's reasonably cohesive — everything serves the single `printRequestStatus()` function. However, it has growing complexity concerns and some duplication with `requests.ts`.

## Findings

### 1. Direct SQL queries bypass `requests.ts` abstraction (Medium)

The file imports `getDb` from `requests.ts` and runs raw SQL in 4 places (lines 133, 370, 373, 583) alongside using the proper abstractions (`getEvaluationsSince`, `getActiveRequests`, `getStaleRequests`). This creates a dual-access pattern — some data goes through the repository layer, some bypasses it.

**Evidence**: Line 370-385 builds agent completion stats with a raw `SELECT ... FROM requests GROUP BY toAgent`. Line 583 queries coach experiments directly. These queries could be functions in `requests.ts`.

**Impact**: If the schema changes, these raw queries break silently while the `requests.ts` functions get updated.

### 2. Monolithic render function (Low-Medium)

`printRequestStatus()` (lines 337-642, ~305 lines) is a single function that builds the entire dashboard. It handles: agent stats, eval quality, process health, triage items, human input trends, convention compliance, and coach experiments — all in one sequential block.

**Impact**: Hard to test individual sections. Hard to extend without growing the function further.

### 3. `loadProcessHealth` has a buggy SQL pattern (Low)

Lines 139-150: The first query uses `MAX(createdAt)` with `status` but without proper grouping — SQLite returns an arbitrary `status` value. Then a second query re-fetches the status by matching on `createdAt = MAX(...)`. This two-query pattern is fragile and could be a single `ORDER BY createdAt DESC LIMIT 1`.

### 4. Hardcoded process registry (Low)

`KEY_PROCESSES` (lines 72-83) hardcodes 10 process names and intervals. If a new cron process is added to `cron.ts`, someone must remember to add it here too. This is a maintenance sync risk.

### 5. Type re-declaration (Cosmetic)

Lines 36-64 declare `EvalRecord`, `AgentStats`, `ProcessInfo`, `AttentionItem` locally. `EvalRecord` is a thin wrapper over `EvaluationRecord` from `requests.ts` (the `loadEvals` function maps between them at line 83-92). This mapping adds no value — could use the source type directly.

## Recommended Actions

1. **Extract raw SQL into `requests.ts` functions** — `getAgentCompletionStats(persistDir, sinceMs)` and `getCoachExperiments(persistDir)`. This centralizes all DB access.
2. **Split `printRequestStatus` into section renderers** — each returning `string[]`, composed by the main function. Enables unit testing per section.
3. **Fix the two-query pattern in `loadProcessHealth`** — use `SELECT * FROM requests WHERE artifact = ? ORDER BY createdAt DESC LIMIT 1`.

## Not Worth Fixing

- The file's overall responsibility (status dashboard) is well-defined and cohesive. No need to split into multiple files.
- The `notifyStatus()` function (line 643) is a thin async wrapper — fine where it is.
