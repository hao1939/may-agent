# EXP-530: Structural Tool Budget Awareness

**Status**: DESIGNED  
**Date**: 2026-05-19  
**Owner**: coach  
**Pattern**: Structural prompt injection (proven in EXP-500/510/520)

## Hypothesis

Injecting a tool call budget and efficiency guidance into worker prompts will reduce redundant tool calls (repeated reads of the same file, unnecessary bash calls) by ≥20%, without reducing output quality.

## Problem Statement

Workers often:
1. Read the same file multiple times in one session (no caching awareness)
2. Run exploratory bash commands that don't contribute to the task
3. Make 30-50+ tool calls when 10-20 would suffice

This wastes tokens and latency. EXP-510 proved structural injection changes behavior — can we apply it to efficiency?

## Treatment Design

**Injection point**: `master-worker.ts` (same location as EXP-510)

**Injected text** (appended to worker prompt):
```
EFFICIENCY GUIDANCE:
- Target: complete this task in ≤15 tool calls
- Do NOT re-read files you've already read this session
- Combine related bash commands with && 
- After every tool call, ask: "did this advance the task?"
- Current budget: {dynamic_count}/15 calls used
```

**Dynamic component**: Counter showing calls used vs budget (soft limit, not enforced)

## Control

Workers without the injection (baseline from recent sessions).

## Metrics

| Metric | How Measured | Target |
|--------|-------------|--------|
| Tool calls per session | Count from session.jsonl | ≤20 median (baseline ~30) |
| Redundant reads | Same file read 2+ times | ≤5% of sessions (baseline ~25%) |
| Output quality | Write rate + finish rate | No regression from EXP-510 levels |
| Task completion | Success status in finish() | No regression |

## Measurement Plan

1. **Baseline**: Sample 30 recent worker sessions, measure tool call count and redundant read rate
2. **Deploy**: Add injection to master-worker.ts
3. **Post-treatment**: Sample 30 sessions with injection, compare metrics
4. **Guard rail**: If write rate drops below 70% or success rate drops below 60%, rollback

## Risks

- Agents may cut corners (fewer tool calls but lower quality) — guard rail metric handles this
- Budget number (15) may be too aggressive for complex tasks — monitor for task-type interaction
- Could conflict with EXP-510's "verify by reading back" requirement

## Success Criteria

- Median tool calls reduced by ≥20% (30 → ≤24)
- No regression in write rate or finish rate
- Redundant reads reduced by ≥50%

## Next Steps

1. Measure baseline (30 sessions): tool call counts, redundant reads
2. Implement injection in master-worker.ts
3. Deploy and collect 30 post-treatment sessions
4. Analyze and decide: promote or reject

## Dependencies

- EXP-510 must remain active (we measure quality against its baselines)
- Need access to master-worker.ts for injection
