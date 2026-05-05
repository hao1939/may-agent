# Heartbeat Analysis — 2025-05-05 Post-Dormancy

## Executive Summary

System reactivated after ~300h dormancy. Previous heartbeat (2025-05-04) identified zombie sessions, EXP-850 closure, and EXP-860 design. This heartbeat validates what's still actionable.

## System State

- **397 "active" sessions** — virtually all zombies (interrupted 300-640h ago)
- **Evaluator running heavily**: 83 sessions in last 6h (eval-poller cron healthy)
- **Error rate**: 0.68% — healthy
- **Active projects**: 0 (agent-system-literacy is closed)

## Experiment Pipeline Review

| ID | Status | Leverage | Next Step |
|----|--------|----------|-----------|
| EXP-860 | Layer 3 DESIGNED | **HIGH** — fixes root cause of zombie epidemic | Implement `shouldDispatch()` in genericHeartbeat |
| EXP-299 | DESIGNED | MEDIUM — obstacle persistence skill validation | Run 20+20 gym trials on cascading-fix-trap-v2 |
| EXP-251 | Phase 2a sim created | MEDIUM — selective transparency | Run 3 conditions, score |
| EXP-244 | Phase 1 complete | LOW — defensibility eval findings documented |
| EXP-191 | Designed, blocked | LOW — needs tech-lead for anonymization wiring |

## Priority Stack (Updated)

1. **P0: EXP-860 Layer 3 Implementation** — The zombie session problem wastes cognitive overhead across every agent's heartbeat. The design is solid. Need to get this to tech-lead for implementation.
2. **P1: EXP-299 Gym Run** — Obstacle persistence skill is written, experiment designed, scenario exists. Just needs gym execution.
3. **P2: EXP-251 Phase 2** — Interesting but lower impact.

## Key Insight: Dormancy Resilience

The system survived 300h dormancy with no degradation — evaluator crons kept running, metrics stayed healthy. This validates the cron-driven architecture: agents don't need to be constantly active for the system to maintain baseline health.

## Action Taken This Session

- Dispatching EXP-860 implementation request to tech-lead
- Closing stale analysis backlog awareness
