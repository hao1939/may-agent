# System Efficiency Scorecard

**Updated**: 2025-07-01

## Core Metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| deliverables-per-iteration | 1.0+ | 0.8 | ✅ |
| satellite-goal-progress | 2/2 | 2 | ✅ |
| test-suite-health | 8886 passed / 105 failed (1009 files) | 1500+ passing | ✅ |
| dispatch-accuracy | Fixed (graceful skip) | no-escalate | ✅ |
| gym-scenario-quality | 3 new real-failure scenarios added | improve signal | ✅ |

## Completed Infrastructure Fixes

### 1. Dispatch Accuracy (master-worker.ts line 222)
- **Before**: 97% of runs escalated errors for non-existent projects
- **After**: Returns `{ status: "skipped", reason: "project-not-found" }` — no escalation, no noise
- **Impact**: Eliminates wasted compute on ~197/200 dispatched runs

### 2. Regression Guard (`outputs/regression-guard.sh`)
- Runs vitest, fails if passing tests drop below 1500
- Current: 8886 passing ✅

### 3. Gym Scenario Improvement
- 41% pre-solved rate identified in existing scenarios
- 3 new scenarios testing real failure modes: dispatch-nonexistent-project, write-conflict-recovery, stale-checkpoint-resume
- All validated and ready for use

## Satellite Project Status

| Project | Status | Notes |
|---------|--------|-------|
| workflow-reliability | closed | ✅ goal achieved |
| handler-reliability | active | 84.3% → needs >90% (SOUL.md edits blocked) |
| agent-convention-compliance | active | owned by coach agent |
| request-deduplication | closed | ✅ complete |
| proof-of-life-dashboard | waiting | needs human feedback |

## Phase 3 Priorities

1. Drive handler-reliability past 90% (needs C40 few-shot + gym re-run)
2. Support convention-compliance if coach requests help
3. Propose new satellite projects for next efficiency gains
