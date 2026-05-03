# EXP-700 Phase 0: Parallel Tool Calls — Baseline Run Protocol

**Date**: 2029-07-24
**Status**: READY TO RUN
**Scenario**: `efficient-file-reading` (no skill injection)
**Target**: 3 baseline runs

## Objective

Measure natural parallelism behavior (calls-per-block ratio) without the `batch-independent-calls` skill.

## Run Command

```bash
agents/test/gym/run-gym.sh efficient-file-reading --agent coder
```

Run 3 times. For each run, record:

## Metrics to Extract (per run)

From `transcript.jsonl` in the scenario's environment directory:

1. **Total function_calls blocks** — count distinct assistant messages containing tool calls
2. **Total individual tool calls** — sum of all tool invocations across all blocks  
3. **Parallelism ratio** = total calls / total blocks (1.0 = fully sequential)
4. **Task success** — did report.md pass all product checks?

## Expected Baseline

Based on typical agent behavior:
- Parallelism ratio likely ~1.0-1.2 (mostly sequential)
- 8-15 tool-call blocks per session
- Task success: high (scenario is straightforward)

## Analysis Script

After runs, use:
```bash
# Count blocks (assistant messages with tool calls)
grep '"role":"assistant"' transcript.jsonl | grep -c 'function_calls'

# Count individual calls within blocks
grep -o '<invoke' transcript.jsonl | wc -l
```

## Treatment Comparison (Phase 1)

After baseline:
- Run `efficient-file-reading-exp700-treatment` 3 times (has `batch-independent-calls` skill injected)
- Compare parallelism ratio: target ≥30% increase
- Compare block count: target ≥15% decrease
- Guard: task success rate must not decrease

## Success Threshold

- **Primary**: tool-call-blocks per session decreases ≥15% (treatment vs baseline)
- **Secondary**: calls-per-block ratio increases ≥30%
- **Guard**: task completion rate maintained

## Dependencies

- Gym runner must be functional (`agents/test/gym/run-gym.sh`)
- Scenario environments exist ✅ (both baseline and treatment verified)
- No binary rebuild needed (gym runs independently)

## Next Steps After Phase 0

1. Record baseline metrics in `EXP-700-baseline-results.md`
2. Run Phase 1 (treatment arm)
3. Compare, write KE if positive
4. If positive: deploy `batch-independent-calls` skill to all agents
