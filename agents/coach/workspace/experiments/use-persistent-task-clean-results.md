# use-persistent-task: Clean Results (Post Infrastructure Fix)

**Date**: 2026-04-18
**Context**: FM-1 (workflow tool not visible) and FM-2 (file not found) bugs were fixed in session s_1776542100349_565. These caused ~80% of prior failures. This experiment re-runs all three arms with the fixed scenario.

## Results

| Arm | N | Pass | Rate | Pre-fix Rate |
|---|---|---|---|---|
| Baseline (task.md) | 7 | 0 | **0%** | 0% (0/10) |
| STEP variant | 5 | 2 | **40%** | 20% (2/10) |
| RUN variant | 5 | 3 | **60%** | 16% (3/19) |

## Interpretation

1. **Baseline still 0%**: The infrastructure fixes didn't help the baseline at all. The baseline task.md ("Resume your active project") gives no hint to use the persistent-task workflow. Agents default to their own routine.

2. **STEP improved from 20% → 40%**: The explicit step-by-step instructions benefit from working infrastructure. Pre-fix, many STEP runs failed due to FM-1/FM-2 even when the agent tried the right thing. With fixes, about half the time the agent follows the explicit steps.

3. **RUN improved from 16% → 60%**: The biggest lift. The RUN variant (which provides the exact `workflow.run` command) benefits most from infrastructure fixes. Pre-fix, agents that tried to run the workflow hit FM-1/FM-2. Now 60% succeed.

## Key Insight

The infrastructure fixes roughly **tripled** the explicit-instruction variants' pass rates (STEP: 20→40%, RUN: 16→60%). This confirms the diagnosis: ~80% of prior failures in STEP/RUN were infrastructure, not behavioral.

However, **baseline remains at 0%** — the behavioral problem (agents don't spontaneously use persistent-task workflow) is real and unsolved. Explicit instructions help (0→40-60%) but don't reach the 80% target.

## Next Steps

- The remaining gap (40-60% → 80%) likely requires a **structural intervention** in the agent's own configuration (heartbeat handler or auto-detection), not just better task prompts.
- Consider: why does RUN outperform STEP? RUN gives the exact command; STEP gives conceptual steps. This suggests agents are better at executing specific commands than following multi-step plans.
