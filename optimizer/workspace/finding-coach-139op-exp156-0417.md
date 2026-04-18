# Finding: Coach 139-op EXP-156 Hard Gate Generalization Session

**Session**: s_1776399785799_320
**Agent**: coach | **OpCount**: 139 | **Status**: running (still)
**Date**: 2026-04-17

## What It Did

EXP-156 Hard Gate Generalization study — ran 42 gym trials across 4 arms:
- misleading-test-fix baseline (11 runs)
- misleading-test-fix treatment (11 runs)
- ambiguous-context-drift baseline (10 runs)
- ambiguous-context-drift treatment (10 runs)

Plus scenario creation (forking 2 scenarios, adding hard gates, smoke tests), statistical analysis, and writing results.md (121 lines).

## Waste Assessment

**Low waste.** 139 ops for 42 gym runs = ~3.3 ops/run overhead. Each gym run requires at minimum 1 op (the run command), plus scenario setup, results parsing, and analysis. The task was inherently large — a full 4-arm experiment with N≥10 per arm.

The session is still marked "running" despite results.md being complete — this may indicate it got stuck on finish/cleanup or is genuinely still executing. No evaluation exists yet.

## Key Patterns

1. **Legitimate high-op session**: Unlike sessions that waste ops on re-reads or thrashing, this session's op count reflects real work (42 gym runs + setup + analysis).
2. **Task too large for single session**: The task instructions say "checkpoint between phases" and "if running long after Phase 2, stop." The session didn't stop — it ran all 4 phases in one session. This isn't necessarily waste, but it means the session couldn't be interrupted/resumed.
3. **No child sessions**: parentSessionId query returned empty — all work was done inline, not delegated.

## Verdict

**Not fixable** — this is appropriate op usage for the task scope. The only optimization would be splitting into 2 sessions (Phase 1-2, Phase 3-4), but that adds coordination overhead.

## Results Quality

The experiment produced strong results: hard gates show +100pp on misleading-test-fix (p < 0.001) but -20pp regression on context-drift (not significant). Cross-experiment table shows pattern: hard gates work for step-skipping failures with low baselines, not for belief-based or high-baseline scenarios.
