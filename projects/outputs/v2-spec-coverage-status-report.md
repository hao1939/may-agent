# v2 Spec Coverage Status Report

**Date:** 2025-01-27  
**Project:** v2-spec-coverage-buildout  
**Status:** P2 pending-review — implementation intentionally deferred  

## Current Metric State

| Metric | Current | Target | Threshold | Status |
|--------|---------|--------|-----------|--------|
| v2 spec measurement coverage | 0.2727 (6/22) | 1.0 | 0.8 | active |

## Coverage Breakdown

### Covered Claims (6/22)
Based on the computation in `agents/may/handlers/metrics-snapshot.ts::countSpecClaimCoverage()`:

- **C8** — via `capability.session-trace-completeness`
- **C10** — via `capability.status-reality-mismatch-count`
- **S6** — via `v2.manager-loc` / `v2.runtime-glue-loc`
- Plus 3 additional claims now covered (rate moved from 0.1364 → 0.2727, i.e. 3→6 covered)

### Uncovered Claims (16/22)
C1, C2, C3, C4, C5, C6, C7, C9, I1, I2, I3, I4, S1, S2, S3, S4, S5, S7, S8 (minus 3 newly covered)

## Assessment

### Why No Action Is Needed Now
1. **P0/P1 metrics are healthy** — no urgent system issues requiring attention
2. **Project is pending-review** — the proposal itself questions whether raw metric-chasing is the right approach
3. **Coverage improved organically** — rate increased from 0.1364 to 0.2727 without dedicated effort, suggesting metrics are being added as capabilities mature
4. **Threshold (0.8) is a milestone target**, not an operational alert — the system functions correctly regardless of coverage rate

### Risks of Premature Action
- Adding metrics purely to increase coverage creates measurement noise
- Spec claims should have measurements that reflect *real operational signals*, not synthetic counters
- The project proposal correctly identifies this: "work should not proceed as raw metric chasing"

### Recommended Triggers for Re-evaluation
- If coverage drops below 0.2 (regression)
- If a P0/P1 incident traces back to an unmeasured spec claim
- If the v2 spec undergoes significant revision
- When P0/P1 project load permits dedicated measurement work

## Conclusion

The v2-spec-coverage-buildout project is correctly deferred at P2. The 27% coverage rate represents organic progress. No intervention required until higher-priority work stabilizes or a specific coverage gap causes operational issues.
