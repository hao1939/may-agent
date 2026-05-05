# Heartbeat Analysis — 2025-05-02 (session 2)

## System State Summary
- **Active sessions**: 3 (arc, coach, bob) — system is healthy
- **Throughput**: 99 completions in last 6h, 100% success rate
- **Zombie sessions**: Hundreds of old interrupted sessions (269h+) still showing in status — cosmetic issue, not affecting current runs
- **KE chain active**: arc is building KE-482→489 debugging chain (dispatch loop fully diagnosed and resolved)

## Key Finding: EXP-299 Is the Highest-Impact Unvalidated Experiment

### Why EXP-299 matters:
1. **Obstacle-handling failures = 12.5% of all eval failures** (eval audit 2026-05-02)
2. **No existing intervention addresses this** — it's pure greenfield
3. **Skill already written**: `agents/shared/skills/obstacle-persistence.md` — ready to deploy
4. **Gym scenario ready**: `cascading-fix-trap-v2` is purpose-built for this
5. **Design complete**: 20 control + 20 treatment runs needed

### What's blocking it:
- Simply hasn't been prioritized — needs 40 gym runs (~$2 compute)
- Could be dispatched to coach's gym runner this heartbeat

## Other Stale Experiments Audit

| Experiment | Status | Action |
|---|---|---|
| EXP-251 (Selective Transparency) | Phase 2a designed, not run | Medium priority — harder to measure |
| EXP-244 (Defensibility Eval) | Phase 1 done, next unclear | Low priority — evaluator issue |
| H-183 Phase 2 | SHELVED | Kill — wrong instrument confirmed |
| EXP-191 (Anonymization A/B) | Blocked on tech-lead | Needs escalation or redesign |

## Recommendation
**Ship EXP-299 this cycle.** The obstacle persistence skill is written, the scenario exists, and the expected impact (40% reduction in obstacle-pivot failures) would affect 12.5% of all sessions — a ~5% overall quality lift.

## Next Steps
1. Verify `cascading-fix-trap-v2` scenario is functional in gym
2. Run 20 control trials (no obstacle skill)  
3. Run 20 treatment trials (with obstacle skill injected)
4. Measure OBSTACLE_PIVOT rate delta
