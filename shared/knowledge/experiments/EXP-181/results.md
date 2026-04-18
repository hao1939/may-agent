# EXP-181 Results: Dead Ends Memory

**Date**: 2026-04-18
**Status**: COMPLETE
**Verdict**: FALSIFIED — no effect detected

## Raw Data

| Scenario | Baseline (5 trials) | Treatment (5 trials) | Delta |
|----------|---------------------|----------------------|-------|
| stale-approach-fixation | 0/5 (0%) | 0/5 (0%) | 0pp |
| stale-error-misdiagnosis-v2 | 3/5 (60%) | 3/5 (60%) | 0pp |
| cascading-fix-trap-v2 | 0/5 (0%) | 0/5 (0%) | 0pp |

**Overall**: Baseline 3/15 (20%) → Treatment 3/15 (20%). Δ = 0pp.

## Intervention

`dead-ends-overlay.md` injected via `--common-sense` flag. Contains general anti-patterns:
- Don't guess file paths — always `ls` first
- Don't assume error cause from message alone — investigate
- Don't fix symptoms without tracing to root cause
- Read workspace/context files before starting work
- If first approach fails, step back and re-examine assumptions

## Analysis

The dead-ends overlay had **zero measurable effect** on any scenario. This is consistent with KE-002 (text rules have 0% success for judgment failures). The overlay adds general advice to the system prompt, but the agent's behavior is unchanged — it either already knows these patterns (misdiagnosis scenario, 60% both arms) or the advice is too abstract to change behavior on hard scenarios (approach-fixation and cascading-fix at 0% both arms).

### Why it failed

1. **Text rules don't change behavior** — The agent reads "don't guess paths" but still guesses paths because the in-context pressure of the task overrides passive advice (KE-002, KE-060).
2. **Too generic** — "Step back and re-examine assumptions" is good advice humans ignore too. It lacks the structural enforcement that would actually change behavior.
3. **Already in context** — The coder's existing common-sense.md already contains similar guidance. Adding more of the same doesn't help.

### Comparison to EvoHarness

In EvoHarness, `dead_ends.md` works because it contains **specific rejected proposals** with concrete reasons — not general advice. Our overlay was general anti-patterns, which is fundamentally different. The mechanism that works in EvoHarness is "here's a specific thing we tried that failed" (experience replay), not "here are general principles" (text rules).

## Decision

**REJECT** — Dead ends as general text advice does not work. 

**Possible follow-up**: Test scenario-specific dead ends (actual prior failures for THIS type of problem). But this risks being scenario-specific and not generalizable. More promising: structural interventions (gates, workflows) per KE-060.

## KE Implications

- Reinforces KE-002: text rules ≈ 0% for judgment failures
- Reinforces KE-060: structural gates > text advice
- New insight: EvoHarness dead_ends.md works via experience replay (specific failures), not general principles. Our adaptation lost the key mechanism.
