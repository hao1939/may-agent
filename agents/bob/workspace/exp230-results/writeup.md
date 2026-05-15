# EXP-230 Results: Evidence Hierarchy Skill

**Date**: 2026-08-28
**Status**: NEGATIVE (ceiling effect on primary metric; no effect on secondary)
**Skill tested**: evidence-hierarchy

## Results

| Check | Control (5 runs) | Treatment (5 runs) |
|-------|------------------|---------------------|
| analysis-exists | 5/5 ✅ | 5/5 ✅ |
| identifies-wrong-file | 5/5 ✅ | 5/5 ✅ |
| rejects-ceiling-effect | 5/5 ✅ | 4/5 ⚠️ |
| read-session-logs | 0/5 ❌ | 0/5 ❌ |
| not-premature | 5/5 ✅ | 5/5 ✅ |
| reasonable-ops | 5/5 ✅ | 5/5 ✅ |

**Overall pass**: Control 0/5, Treatment 0/5 (all fail on `read-session-logs`)

## Key Findings

1. **Ceiling effect on primary target**: `identifies-wrong-file` was 0% in EXP-229 baseline but is now 100% in both conditions. The scenario's key challenge has become trivially easy — possibly due to model improvements or scenario familiarity.

2. **No effect on read-session-logs**: The evidence-hierarchy skill (Ch1 text instruction) did NOT cause agents to read raw session logs. 0/5 in both conditions. This confirms EXP-229's finding that reasoning-chain gaps resist Ch1 interventions.

3. **Slight regression in treatment**: Treatment had one extra failure (rejects-ceiling-effect), suggesting the skill may slightly distract the agent.

## Decision

**REJECT** evidence-hierarchy skill for this use case. Do NOT promote.

## Implications

- Ch1 text skills confirmed insufficient for "read the raw data" behavior
- The approach-validation-trap scenario needs updating — its primary challenge is solved
- Next attempt should use Ch2 (environmental) intervention: e.g., put a `WARNING: summary may be outdated` file next to summaries, or remove the summary entirely

## Next Steps

- Update scenario to restore difficulty (new challenge or harder variant)
- Design Ch2 environmental experiment for read-session-logs behavior
- Archive evidence-hierarchy skill (it may still help in other contexts but not here)
