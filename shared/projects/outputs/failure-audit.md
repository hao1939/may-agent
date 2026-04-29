# Failure Audit Report

**Date:** 2025-01-14  
**Scope:** `.state/`, `agents/*/context.md`, session patterns

## Top 5 Failure Patterns

### 1. WRITE-FIRST Constraint Violations
- **Frequency:** ~30% of iterations require explicit reminders
- **Pattern:** Agent reads/explores before writing when task says "write first"
- **Fix:** Enforce WRITE-FIRST as a hard gate in task dispatch; reject iterations that start with read()

### 2. Deliverables in Gitignored Directories
- **Frequency:** Every iteration produces to `projects/outputs/` (gitignored)
- **Pattern:** Work is done but not persisted in version control
- **Fix:** Primary deliverables should go in tracked paths; outputs/ is for reports only

### 3. False Completion Claims
- **Frequency:** ~15% of iterations claim "already done" without verification
- **Pattern:** Agent assumes prior work persists without reading files
- **Fix:** Always verify with read() before claiming completion; never assume

### 4. Orphan Files / Incomplete Integration
- **Frequency:** 2-3 iterations needed to move files from outputs → actual codebase
- **Pattern:** First pass writes to wrong location, second pass moves it
- **Fix:** Task should specify exact target path upfront; write directly there

### 5. Session Context Loss Between Iterations
- **Frequency:** Every iteration starts fresh
- **Pattern:** Agent re-discovers project state each time (runs health-check, reads project.md)
- **Fix:** Checkpoint state more aggressively; include "current state" summary in task dispatch

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total iterations analyzed | 12 |
| Iterations with rework needed | 4 (33%) |
| Iterations fully successful first-try | 8 (67%) |
| Average deliverables per iteration | 1.2 |

## Recommendations

1. **Task precision:** Include exact file paths and expected structure in every task
2. **Reduce gitignored outputs:** Only reports go in outputs/; code goes in lib/
3. **Checkpoint aggressively:** After every successful step, save state
4. **Verify before claiming done:** Always run tests or read files to confirm
