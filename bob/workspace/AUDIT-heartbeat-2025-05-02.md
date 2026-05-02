# Heartbeat Audit — 2025-05-02

## System Health Snapshot

- **Active sessions**: 399 (only 3 truly running, 1 idle, rest are stale/interrupted)
- **Success rate (6h)**: 97% — healthy
- **Errors**: Only `dev` agent with expired IDE tokens (3 occurrences)
- **Handler fires/hour**: 38 (target 30) — slightly above, healthy
- **Real output files (24h)**: 1,595 — very productive

## Key Observation: Stale Session Accumulation

The system reports 399 "active" sessions but only 3-4 are genuinely running. The rest are **interrupted sessions dating back hundreds of hours** that were never cleaned up. This doesn't cause operational harm (the system works fine) but it pollutes observability.

Examples of very old interrupted sessions:
- `amy` (s_1777626616591_0): Running 19h — gym scenario, likely hung
- `may` (s_1775485773079_0): Idle 58h — user reply that was never continued
- Multiple `bob` sessions from 260-290h ago: "Ship EXP-188 finish-guard" repeated dozens of times

### Pattern: Repeated Task Dispatch Without Completion

Bob had **~40+ sessions** all trying to "Ship EXP-188 finish-guard to production" and "Resume context-learning project" — each interrupted without completion. This suggests the dispatch system was repeatedly creating new sessions for the same task without checking if prior attempts existed.

**Root cause**: This was likely before dispatch dedup guards were added. The current system has dedup, so this specific pattern should not recur.

## Active Work Items (Bob)

| Item | Status | Next Action |
|------|--------|-------------|
| EXP-299 (Obstacle Persistence) | Designed, ready | Run 20+20 gym trials on cascading-fix-trap-v2 |
| KE-440 gym test | Ready to design | Test "trust the test" KE injection in gym |
| EXP-251 Phase 2a (Selective Transparency) | Scenario created | Run 3 conditions and score |
| H-183 Phase 2 | Needs new approach | Evaluator A/B with Grade-A vs Grade-C KEs |
| EXP-244 Phase 2 | Phase 1 done | Fix 3 false-negative eval patterns |

## Recommendation

**Highest-impact next action**: Run EXP-299. It has:
- Clear hypothesis (H-215: obstacle guard ≥40% reduction in OBSTACLE_PIVOT)
- Skill already written (`agents/shared/skills/obstacle-persistence.md`)
- Scenario ready (cascading-fix-trap-v2)
- Direct production impact (reduces wasted cycles on incorrect pivots)

## Metrics Assessment

All metrics are within acceptable ranges. The ⚠️ flags are informational:
- Handler p95 at 250s (target 120s) — some long-running tasks, acceptable
- 1 stale active project — likely the instruction-following archive entry
- Session error rate 1.3% — well below threshold
