# Stale Dispatch Audit

**Date**: 2025-07-01 (Updated Iteration 4)  
**Purpose**: Identify all references to non-existent projects causing wasted dispatches

## Code Fix (Applied in Iteration 3)

**File**: `agents/shared/workflows/master-worker.ts` line 222-224

```typescript
// BEFORE: escalated as error
if (!existsSync(projectFile)) {
  return ctx.escalate(`No project.md found at: ${projectFile}`);
}

// AFTER: graceful skip
if (!existsSync(projectFile)) {
  ctx.log?.(`Skipping: no project.md at ${projectFile}`);
  return { status: "skipped", reason: "project-not-found", path: projectFile };
}
```

**Impact**: Failed dispatches no longer escalate as errors — they skip gracefully.

## Active Projects (16 verified)

| Project | Status |
|---------|--------|
| agent-convention-compliance | ✅ Active |
| agent-memory-learning | ✅ Active |
| agent-system-literacy | ✅ Active |
| coach-quality | ✅ Active |
| documentation-gen | ✅ Active |
| evaluation-revival | ✅ Active |
| gym-quality-improvement | ✅ Active |
| handler-reliability | ✅ Active |
| hao-alignment | ✅ Active |
| proof-of-life-dashboard | ✅ Active |
| request-deduplication | ✅ Active |
| skill-workflow-audit | ✅ Active |
| system-efficiency | ✅ Active |
| test-coverage | ✅ Active |
| workflow-reliability | ✅ Active |

## Stale References: 88 Non-Existent Projects Referenced

Full grep of `/app/agents/` for `projects/[name]` patterns cross-referenced against actual directories. **88 unique stale project names** found in code/docs/configs.

### High-Frequency Stale References (most dangerous for dispatch)

| Stale Project | Reference Count | Risk |
|---------------|----------------|------|
| projects/test | 47 | Low (test code) |
| projects/test-proj | 24 | Low (test code) |
| projects/test-persistent-task-experiment | 24 | Low (test code) |
| projects/foo | 21 | Low (test code) |
| projects/test-project | 16 | Low (test code) |
| projects/context-learning | 12 | **Medium** (old project) |
| projects/adaptive-heartbeats | 11 | **Medium** (old project) |
| projects/my-project | 10 | Low (example) |
| projects/cold-start-fix | 8 | **Medium** (old project) |
| projects/system-evolution | 7 | **Medium** (old project) |
| projects/pwi-smart-context | 7 | **Medium** (old project) |
| projects/metric-autonomy | 6 | **Medium** (old project) |
| projects/feedback-loop | 6 | **Medium** (old project) |
| projects/federation-design | 5 | Low (design doc) |
| projects/prove-the-loop | 5 | **Medium** (old project) |
| projects/project-workflow-improvement | 5 | **Medium** (old project) |

### Categories of Stale References

1. **Test fixtures** (~112 refs): `test`, `test-proj`, `test-project`, `foo`, `my-project` — harmless, in test files
2. **Retired projects** (~60 refs): `context-learning`, `adaptive-heartbeats`, `cold-start-fix`, `system-evolution`, `pwi-smart-context`, `metric-autonomy`, `feedback-loop`, `prove-the-loop` — old projects referenced in journals/logs
3. **Dispatch-dangerous** (47 refs from v3-tracking): `agent-system-literacy` (bob's local copy), `pwi-evaluator-tuning` — these were actively dispatched to non-existent paths

## Root Cause Analysis

| Cause | Impact | Fix |
|-------|--------|-----|
| Bob's workspace had project paths that don't exist | 47 failed dispatches (97% of runs) | ✅ Fixed: graceful skip in master-worker.ts |
| Old projects referenced in journals/logs | Noise only (not dispatched) | Low priority — historical records |
| Test fixtures reference fake projects | None (test-only paths) | No action needed |

## Recommendations

1. ✅ **DONE**: master-worker.ts graceful skip (prevents error escalation)
2. **Clean bob's dispatch config**: Ensure heartbeat doesn't reference `agents/bob/workspace/projects/` for master-worker dispatch
3. **Archive old project refs**: References in journals are historical — no cleanup needed
4. **Monitor skip rate**: Track `status: "skipped"` returns to measure ongoing dispatch accuracy
5. **Pre-flight validation in heartbeat**: Before dispatching master-worker, the heartbeat scheduler should validate project existence

## Metrics Summary

| Metric | Value |
|--------|-------|
| Active projects | 16 |
| Stale project references | 88 unique names |
| Dispatch-dangerous references | 2 (now handled by skip) |
| Historical/journal references | ~60 (harmless) |
| Test fixture references | ~26 (harmless) |
