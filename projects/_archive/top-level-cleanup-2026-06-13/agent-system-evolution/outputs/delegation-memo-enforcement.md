# Delegation Memo Enforcement

**Date**: 2026-05-25  
**Status**: Implemented  
**Task**: delegation-memo-enforcement

## Problem

Delegation-memo convention adoption remained at 0% after two measurement cycles.
Agents were not voluntarily including structured delegation fields in fork/call tasks.

## Solution

Injected the delegation-memo convention directly into the fork/call task prompt
assembly in `manager-agents-tool.ts`. Every task dispatched via `agents.call` or
`agents.fork` now automatically includes:

1. **Context files section** (if provided) — already existed
2. **Success criteria section** (if provided) — NEW: now appended from `success_criteria` param
3. **Delegation Memo footer** — NEW: always appended, reminding the receiving agent of its obligations

## Implementation

**File**: `projects/platform/repos/may-agent/src/lib/manager-agents-tool.ts`

Changes:
- `appendContextFiles()` → expanded to `appendContextFiles(task, contextFiles?, successCriteria?)`
- Now always appends a "## Delegation Memo" section with the 3 receiver obligations
- `success_criteria` parameter (already in schema) is now actually passed through to the task text
- Both `call` and `fork` code paths updated

## Verification

- TypeScript compiles clean (`tsc --noEmit` — no errors on this file)
- All 14 existing tests pass
- Manual simulation confirms memo appears in both cases (with/without context_files)

## Expected Impact

Every fork/call session created after deployment will contain the delegation memo
in its task prompt. Receiving agents will see explicit instructions to:
- Read context_files first
- Verify success criteria with evidence
- Stay within scope

This moves from voluntary adoption to automatic injection — 100% coverage.
