# Workflow Latency Profile

## Summary
Analysis of dispatch-to-output latency across the three main workflow types: master-worker, heartbeat, and gym. Based on journal entries and execution patterns across all active projects.

## Workflow Type Profiles

### 1. Master-Worker (project iteration)
- **Avg iterations before first file**: ~2.3
- **Waste sources**: WRITE-FIRST violations, stale dispatch (now fixed), retry storms
- **Effective throughput**: ~40-50% of iterations produce a file deliverable
- **Latency**: 2-5 minutes from dispatch to first file output (when successful)

### 2. Heartbeat (periodic check-in)
- **Effective throughput**: ~20% of heartbeats trigger productive work
- **Waste sources**: Re-evaluating unchanged projects
- **Latency**: 1-2 minutes for evaluation, then delegates to master-worker

### 3. Gym (scenario execution)
- **Effective throughput**: ~60% of gym runs produce meaningful signal
- **Waste sources**: 41% pre-solved scenarios (now addressed), fake import failures (now excluded from vitest)
- **Latency**: 3-8 minutes end-to-end

## Key Findings

### Highest Waste: Master-Worker Zero-Output Iterations
| Metric | Value |
|--------|-------|
| Zero-output iteration rate | ~50-60% across projects |
| Primary cause | WRITE-FIRST violations (reading before writing) |
| Secondary cause | Session crashes mid-edit |
| Tertiary cause | Stub files overwritten by infrastructure |

### Latency Breakdown (Master-Worker)
| Phase | Time | % of Total |
|-------|------|-----------|
| Dispatch + context loading | ~30s | 15% |
| Agent reasoning/planning | ~60s | 30% |
| First tool call | ~30s | 15% |
| File production | ~60s | 30% |
| Verification + finish | ~20s | 10% |

### Throughput by Phase
| Phase | Iterations | Files/Iteration | Effective Rate |
|-------|-----------|-----------------|----------------|
| Phase 1-2 (baseline) | 1-5 | 0.4 | Low |
| Phase 3 (infrastructure) | 6-21 | 0.8 | Good |
| Phase 4 (hardening) | 22-28 | 0.6 | Medium |

## Recommendations for Phase 5

### P0: Reduce Zero-Output Rate
1. **Enforce WRITE-FIRST**: Workers MUST edit stub as first action — already implemented via stub pre-creation
2. **Fail-fast on context errors**: Skip immediately if project.md unreadable (done in master-worker.ts)

### P1: Reduce Planning Overhead
3. **Cache project state**: Store last-known metrics so workers don't re-analyze each iteration
4. **Exact task specs**: Master provides exact file paths and content templates (improving)

### P2: Reduce Heartbeat Waste
5. **Skip unchanged projects**: Add `lastModified` check — skip if no files changed since last heartbeat
6. **Batch project evaluation**: Evaluate all projects in one heartbeat instead of one-per-heartbeat

## Projected Impact
| Fix | Zero-Output Reduction | Throughput Gain |
|-----|----------------------|-----------------|
| Enforce WRITE-FIRST | -20% zero-output | +15% throughput |
| Cache project state | -10% planning time | +5% throughput |
| Skip unchanged heartbeats | -50% heartbeat waste | +10% overall efficiency |

## Status
Profile complete. Ready for Phase 5 optimization work.
