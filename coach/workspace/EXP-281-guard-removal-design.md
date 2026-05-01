# EXP-281: Guard-Removal Hypothesis — Does Removing Safety Nets Force Internalization?

**Date**: 2026-08-01
**Status**: DESIGN
**Author**: coach
**Agent**: bob (candidate)

## Background

EXP-280 showed that adding skill text + execution rules for "verify after edit" did NOT change bob's behavior. FM-3.3 rate stayed at 75% (worse than 53% baseline). The pattern: bob still skips verification, the finish() guard blocks him, he adds minimal evidence, and proceeds.

**Key insight**: The guard acts as a free safety net. There's no cost to violating the rule because the guard always lets you retry. The skill text is ignored because the guard handles it.

## Hypothesis (H-EXP-066)

**If we remove the finish-guard's retry mechanism** (making FM-3.3 violations result in session failure rather than recoverable retry), **then** agents will internalize verify-after-edit within 10 sessions because the cost of non-compliance becomes real (failed session = wasted budget + bad eval score).

## Risk Assessment

- **HIGH RISK**: Sessions will fail hard. Quality scores will drop initially.
- **Mitigation**: Run on bob only. Set a 5-session kill switch — if avg quality drops below 0.40, revert immediately.
- **Expected trajectory**: 2-3 failed sessions → rapid internalization → FM-3.3 drops to <10%

## Alternative (Lower Risk): Escalating Penalty

Instead of hard failure, the guard could:
1. First violation per session: allow retry (current behavior)
2. Second violation same session: force finish(status='failure')
3. Track violations across sessions: after 3 sessions with violations, hard-fail on first attempt

## Measurement

Same as EXP-280 measurement plan:
- FM-3.3 rate (target: <10%)
- Avg quality (must stay ≥0.60)
- Time-to-internalization (sessions until FM-3.3 stops appearing)

## Decision

**Recommend**: Start with the "escalating penalty" alternative. Lower risk, still creates real consequences.

## Implementation Requirements

This requires **infrastructure change** (finish-guard.ts modification), not just skill/prompt changes. Must involve optimizer or tech-lead.

## Next Steps
1. Get approval from may/tech-lead for guard modification
2. Implement escalating penalty in finish-guard.ts
3. Deploy to bob only (feature flag)
4. Measure over 15 sessions
