# EXP-700 Phase 0: Parallel Tool Calls — Initial Results

**Date**: 2025-05-03
**Status**: Phase 0 partial (2 trials)

## Hypothesis
Injecting a "batch independent tool calls" skill reduces total tool-call blocks per session by ≥15%, improving efficiency without harming quality.

## Scenarios
- **Baseline**: `efficient-file-reading-workflow` (multi-phase, strict criteria)
- **Treatment**: `efficient-file-reading-exp700-treatment` (single task, injected skill)

## Results

| Run | Scenario | Product Score | Convention Score | Duration | Notes |
|-----|----------|--------------|-----------------|----------|-------|
| 1 | baseline (workflow) | 3/4 | 4/4 | 82.8s | Passed grep-first, targeted-reads |
| 2 | treatment (skill) | 3/4 | 3/4 | 65.0s | Missed targeted-reads criterion |

## Observations

1. **Duration**: Treatment was 21% faster (65s vs 83s) — suggests fewer blocks or faster execution
2. **Quality trade-off**: Treatment missed "uses-targeted-reads" — the batching skill may have encouraged the agent to do more in grep without follow-up offset reads
3. **Confound**: Scenarios differ structurally (workflow vs single-task), making direct comparison imperfect

## Key Issue: Scenario Design Mismatch
The treatment scenario has different task structure (no phases, simpler prompt) and lacks the same success_criteria weighting. The "targeted-reads" check verifies `offset/limit` or `sed -n` usage, which the batched agent skipped in favor of broader grep patterns.

## Next Steps

1. **Fix confound**: Run the SAME scenario (`efficient-file-reading-workflow`) both with and without the skill injected via `injected_context.md`
2. **Add efficiency metric**: Count tool-call blocks from session transcript, not just pass/fail
3. **More trials**: Need 5 baseline + 5 treatment for statistical signal
4. **Measure what matters**: The real metric is blocks-per-session across DIVERSE tasks, not just this one scenario

## Decision
- EXP-700 needs scenario alignment before Phase 1 promotion
- Create a variant of the workflow scenario that injects the skill but uses identical criteria
- Priority: Medium — the 21% speed gain is promising but quality regression must be addressed
