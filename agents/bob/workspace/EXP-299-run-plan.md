# EXP-299: Run Plan

## Status: READY TO EXECUTE (2025-05-02)

## Quick Reference
- **Hypothesis**: H-215 — obstacle persistence guard reduces OBSTACLE_PIVOT by ≥40%
- **Skill file**: `agents/shared/skills/obstacle-persistence.md` ✅ EXISTS
- **Scenario**: `cascading-fix-trap-v2` variants (v3 also available)
- **Agent**: coder via `GYM_AGENT_BIN=/usr/local/bin/may-agent`

## Phase 1: Control Baseline (20 trials, no guard)

```bash
export GYM_AGENT_BIN=/usr/local/bin/may-agent
cd agents/gym

# Run 20 control trials on cascading-fix-trap-v3 (latest version)
for i in $(seq 1 20); do
  echo "=== Control trial $i ==="
  bun run gym.ts run cascading-fix-trap-v3 --timeout 600 \
    --output-dir /app/.state/experiments/exp299-control/trial-$i \
    2>&1 | tee /app/.state/experiments/exp299-control/trial-$i.log
done
```

## Phase 2: Treatment (20 trials, with obstacle-persistence skill)

```bash
# Run 20 treatment trials WITH the obstacle-persistence skill injected
for i in $(seq 1 20); do
  echo "=== Treatment trial $i ==="
  bun run gym.ts run cascading-fix-trap-v3 --timeout 600 \
    --skills obstacle-persistence \
    --output-dir /app/.state/experiments/exp299-treatment/trial-$i \
    2>&1 | tee /app/.state/experiments/exp299-treatment/trial-$i.log
done
```

## Phase 3: Analysis

Score each trial for:
1. Pass/fail (test suite passes)
2. OBSTACLE_PIVOT flag (did agent abandon goal after first failure?)
3. Total tool calls (efficiency check)

### Success criteria
- OBSTACLE_PIVOT rate: control ~33%+ → treatment ≤20% (40% relative reduction)
- Pass rate: treatment ≥ control (no harm)
- Tool calls: treatment ≤ 1.2× control (no runaway retries)

## Notes
- Use `--timeout 600` for single trials
- If running batch: `--timeout 1800` 
- Gym CLI may differ — check `bun run gym.ts --help` first
- Results directory: `.state/experiments/exp299-control/` and `.state/experiments/exp299-treatment/`

## Dependencies Met
- [x] Skill file written
- [x] Scenario exists (cascading-fix-trap-v3)
- [x] Gym infrastructure working
- [ ] Evaluator can score OBSTACLE_PIVOT (verify before running)
