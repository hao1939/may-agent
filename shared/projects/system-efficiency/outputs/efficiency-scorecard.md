# System Efficiency Scorecard

**Generated**: 2025-07-25

## Core Metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| deliverables-per-iteration | 1.0 (6/6) | 0.8 | ✅ |
| satellite-goal-progress | 2/2 | 2 | ✅ |
| worker-first-attempt-success | 1.0 (6/6) | 0.7 | ✅ |
| test-suite-health | 1565 tests / 91 files | 60+ | ✅ |

## Satellite Project Status

| Project | Status | Goal Met? |
|---------|--------|-----------|
| documentation-gen | active | ✅ docs.coverage 1.0, staleness 6d |
| workflow-reliability | closed | ✅ goal achieved |

## System Throughput Analysis

### Dispatch Accuracy Problem (Critical)

Per workflow-reliability findings, **97% of master-worker runs error before starting**:
- 200 recent runs analyzed: 197 errored, 2 completed, 1 running
- Root cause: scheduler dispatches workflows for non-existent projects
- Top offenders: `agent-system-literacy` (24 fails), `pwi-evaluator-tuning` (23 fails)
- Error path: master-worker.ts line ~190 "No project.md found" → escalate → error

### Impact

Real system throughput is ~1% of dispatched runs. The 6/6 success rate in this project is genuine but only possible because the project exists. The system wastes ~97% of its compute on runs that fail instantly.

### Proposed Fix

1. **Pre-flight check**: Before dispatching master-worker, verify project.md exists at target path
2. **Scheduler cleanup**: Remove stale project references from heartbeat/scheduling configs
3. **Guard in master-worker.ts**: Early return with "project not found" instead of escalate (reduce noise)

## Next Priorities

1. Fix dispatch accuracy — highest leverage improvement possible
2. Find next satellite to drive toward its goal
3. Add regression guard for test suite (fail if < 1500 tests)
