# RX-058: Production Observation Pilot

**Status**: COMPLETE (Phase 1)
**Date**: 2026-04-05

## Design

Observe agent behavior in production for 7 days. Catalog all failure mode instances with:
1. Failure mode classification (FM-1.x, FM-2.x, FM-3.x)
2. Tool-call count
3. Recovery pattern (or lack thereof)
4. Time wasted

## Phase 1 Results (7-day observation)

### Top Failure Modes by Frequency

| FM | Description | Count | Avg Tool Calls Wasted |
|----|-------------|-------|-----------------------|
| FM-1.3 | Path-guessing / flailing | 15 | 8.3 |
| FM-2.6 | Delegation instead of execution | 7 | 12.1 |
| FM-3.1 | Non-delivery (work done, not saved) | 4 | 15.0 |

### FM-1.3 Breakdown

| Sub-pattern | Count | % of FM-1.3 |
|-------------|-------|-------------|
| Path construction from memory | 9 | 60% |
| Missing ls before read | 3 | 20% |
| Wrong directory level | 3 | 20% |

### Key Insight

FM-1.3 is the highest-volume failure mode (15 instances in 7 days). 60% are path construction from memory — the agent tries to construct file paths without listing the directory first. Despite having a skill file that says "always ls before read", the behavior persists.

## Phase 2 Recommendation

Design a structural intervention (Phase 0 discovery pre-phase) for the deliver-or-report workflow that forces directory listing before any file reads.

## Connections

- Validates: RKE-007 (skills don't fix this)
- Motivates: New experiment for structural FM-1.3 intervention
- Supports: RH-044 (structural interventions needed)
