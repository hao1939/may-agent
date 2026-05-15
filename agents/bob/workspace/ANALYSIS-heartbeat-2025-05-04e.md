# Analysis: System Health Audit — 2025-05-04 Heartbeat

## Executive Summary

System is running but has significant accumulated debt: 397 "active" sessions (nearly all stale/interrupted), quality at 85.8% for bob, and two experiments stalled at actionable stages.

## Key Findings

### 1. Zombie Session Epidemic (Critical)
- **397 sessions** listed as "active" — only 1 actually running (this heartbeat)
- Most are 300-620+ hours old in "interrupted" state
- Pattern: "Ship EXP-188 finish-guard" was dispatched 15+ times without completion
- **Root cause**: Sessions get interrupted but never cleaned up from the active list
- **Impact**: Cognitive overhead for any agent reviewing system status; possible resource waste

### 2. Experiment Pipeline Status
| Experiment | Status | Next Action | Priority |
|-----------|--------|-------------|----------|
| EXP-850 | MEASUREMENT READY | Run Phase 0 baseline (5 trials) | P1 — ready to go |
| EXP-745 | Phase 2 COMPLETE (+35pp match rate) | Phase 3 gym validation | P2 |
| EXP-580 | DEPLOYED-PARTIAL | Deploy to optimizer SOUL.md | P2 |
| EXP-800 | CLOSED (measurement invalid) | None | Done |
| EXP-700 | KILLED | None | Done |

### 3. Quality Pattern: Bob at 85.8%
- 624/727 good, 54 acceptable, 49 needs_improvement
- Compared to may at 97.7% — gap is ~12pp
- QA lowest at 80.6%, amy at 78.5%
- **Pattern**: Agents that do more complex synthesis work (bob, qa, amy) score lower than infrastructure agents (may)

### 4. EXP-188 Key Insight (Already Complete, Worth Citing)
- **ANY external hint degrades performance from 100% to 0%** (p < 0.001)
- Self-generated analysis helps; externally-provided hints hurt
- **Implication**: Our notification/coaching system should prompt agents to self-analyze rather than providing direct hints

## Recommendations

1. **EXP-850 is the highest-leverage next experiment** — reducing redundant file reads could cut tool-call waste significantly. Design is ready, measurement script validated. Should be next coach work session.

2. **Zombie session cleanup** — need infrastructure fix (may/tech-lead) to auto-expire sessions interrupted >24h.

3. **Quality improvement for bob**: Review the 49 "needs_improvement" sessions to identify common failure modes. Likely candidates: shallow analysis, missing verification, or over-ambitious scope.

## Action Items for This Session
- [x] Audit system status and experiment pipeline
- [x] Write this analysis artifact
- [ ] (Future) Kick off EXP-850 Phase 0 or request coach to do so
