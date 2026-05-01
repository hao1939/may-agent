# Stale Dispatch Audit

**Date**: 2025-07-01
**Author**: Worker (system-efficiency iteration 3)

## Code Fix Applied

**File**: `agents/shared/workflows/master-worker.ts` line 222-224

**Before** (escalated as error):
```typescript
if (!existsSync(projectFile)) {
  return ctx.escalate(`No project.md found at: ${projectFile}`);
}
```

**After** (graceful skip):
```typescript
if (!existsSync(projectFile)) {
  ctx.log?.(`Skipping: no project.md at ${projectFile}`);
  return { status: "skipped", reason: "project-not-found", path: projectFile };
}
```

**Impact**: Failed dispatches to non-existent projects no longer escalate as errors. They return a `skipped` status, reducing noise and false error counts.

## Stale Project References

### Confirmed Stale (from v3-tracking-results.md)

| Path | Failed Dispatches | Status |
|------|-------------------|--------|
| `agents/bob/workspace/projects/agent-system-literacy` | 24 | No project.md exists |
| `agents/bob/workspace/projects/pwi-evaluator-tuning` | 23 | No project.md exists |

These two phantom projects accounted for **47 failed dispatches** — 97% of all master-worker runs.

### Active Projects (verified exist)

The following projects under `agents/shared/projects/` have valid `project.md` files:
- agent-convention-compliance
- agent-memory-learning
- agent-system-literacy
- coach-quality
- documentation-gen
- evaluation-revival
- gym-quality-improvement
- handler-reliability
- hao-alignment
- proof-of-life-dashboard
- request-deduplication
- skill-workflow-audit
- system-efficiency
- test-coverage
- workflow-reliability

### References Found

- `agents/shared/guards/literacy-regression.md` references `agent-system-literacy` (valid — project exists at shared/projects/)
- `agents/bob/journal.md` references `pwi-evaluator` (stale — bob's local copy doesn't exist)
- `agents/bob/workspace/heartbeat-log-20260902.md` references stale projects

## Root Cause

Bob's heartbeat/context was configured to dispatch master-worker runs for projects at `agents/bob/workspace/projects/` — a path that doesn't contain valid project.md files. The correct projects live at `agents/shared/projects/`.

## Recommendations

1. ✅ **Code fix applied**: master-worker.ts now skips gracefully instead of escalating
2. **Clean up bob's config**: Remove references to `agents/bob/workspace/projects/agent-system-literacy` and `pwi-evaluator-tuning`
3. **Add dispatch validation**: Consider a pre-flight check that logs which projects are being dispatched and whether they exist, before the workflow even starts
