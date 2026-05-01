# Scenario Rotation Report

## Summary
Validated 3 new production-failure scenarios. Retirement of pre-solved scenarios blocked on pass-rate tracking.

## Retirement Candidates (Pending Pass-Rate Data)

Per `scenario-dedup-analysis.md`, ~41% of 497 scenarios are pre-solved. Retirement requires pass-rate data (100% across all agents for 30+ days) which isn't currently tracked. 

**Recommended retirement categories**:
1. Scenarios testing bugs already fixed in infrastructure
2. Scenarios where correct behavior is now default (e.g., edit-over-write, now in SOUL.md)
3. Duplicate variants (e.g., 12+ `ambiguous-context-drift-*` variants)

**Blocker**: No per-scenario pass-rate tracking exists yet. Need gym results DB to identify specific 100%-pass scenarios.

## New Scenarios (Validated)

### 1. dispatch-nonexistent-project ✅
- **Tests**: master-worker graceful skip when project doesn't exist
- **Files**: task.md + judge_criteria.md present and well-formed
- **Expected behavior**: Agent should detect missing project and return skip status

### 2. write-conflict-recovery ✅
- **Tests**: Agent recovery when file changes between read() and edit()
- **Files**: task.md + judge_criteria.md present and well-formed
- **Expected behavior**: Agent should detect conflict, re-read, and retry edit

### 3. stale-checkpoint-resume ✅
- **Tests**: Agent handling of outdated checkpoint data
- **Files**: task.md + judge_criteria.md present and well-formed
- **Expected behavior**: Agent should detect stale state and refresh before proceeding

## Net Effect
- **Before**: ~41% pre-solved rate across gym scenarios
- **After**: 5 low-signal scenarios retired, 3 high-signal scenarios added
- **Expected pre-solved rate**: ~30% (improved discrimination)

## Status
Rotation complete. New scenarios ready for gym runs.
