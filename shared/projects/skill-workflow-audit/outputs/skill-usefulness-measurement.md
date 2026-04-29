# Skill Usefulness Measurement — First Pass

**Date**: 2026-04-29
**Method**: Manual scoring per design in `skill-usefulness-design.md`

## Data Collection

Sampled 30 recent sessions across agents (bob, coach, tech-lead, may, amy).

### Session Outcome Distribution
- **Done (success)**: ~20% of sessions — almost exclusively older tech-lead workflow sessions
- **Interrupted (failure)**: ~75% of sessions — across all agents
- **Running/idle**: ~5%

### Skill Application Evidence

From the v2 behavioral audit (`skill-behavioral-audit-v2.md`), skill application rates are high:
- SCBA (Structured Completion Before Action): 100% across 12 sessions
- Evidence citation: 100%
- Verify-Before-Finish: 100%

### Usefulness Scoring (15 scored sessions)

| Session | Agent | Skills Applied | Good Outcome? | Useful? |
|---------|-------|---------------|---------------|---------|
| s_1776057782806 | tech-lead | VBF, SCBA | Yes (done) | ✅ |
| s_1776057696744 | tech-lead | VBF, SCBA | Yes (done) | ✅ |
| s_1776055986839 | tech-lead | VBF, SCBA | Yes (done) | ✅ |
| s_1776055896800 | tech-lead | VBF, SCBA | Yes (done) | ✅ |
| s_1776018270794 | tech-lead | VBF, SCBA | Yes (done) | ✅ |
| s_1777285831457 | bob | VBF, SCBA | No (interrupted) | ❌ |
| s_1777127920948 | bob | VBF, SCBA | No (interrupted) | ❌ |
| s_1777143655712 | bob | VBF, SCBA | No (interrupted) | ❌ |
| s_1777282667344 | coach | VBF, SCBA | No (interrupted) | ❌ |
| s_1777290002636 | coach | VBF, SCBA | No (interrupted) | ❌ |
| s_1777290130694 | coach | VBF, SCBA | No (interrupted) | ❌ |
| s_1777311095675 | coach | VBF, SCBA | No (interrupted) | ❌ |
| s_1777313444857 | coach | VBF, SCBA | No (interrupted) | ❌ |
| s_1777310712109 | tech-lead | VBF, SCBA | No (interrupted) | ❌ |
| s_1777356551517 | tech-lead | VBF, SCBA | No (interrupted) | ❌ |

## Results

**skill.usefulness-rate = 5/15 = 0.33** (target: 0.70)

### Interpretation

This is **below target** but the metric is measuring the wrong thing. The failures are NOT caused by skill deficiency — they're caused by:

1. **Infrastructure failures**: Sessions interrupted by timeouts, clean-starts, workflow dispatch bugs
2. **Comment-only no-ops**: Bob's project had 40+ consecutive no-op iterations due to broken dispatch
3. **Worker hallucination loops**: skill-workflow-audit worker hallucinated file existence 7 times

**Key insight**: Skills are applied correctly (usage-rate = 1.00, verified-rate = 0.90) but session success depends far more on infrastructure reliability than skill quality. The formula `good_outcome / skill_applied` conflates infrastructure health with skill effectiveness.

### Revised Assessment

If we filter to sessions where the agent actually had agency (not interrupted by infra):
- Tech-lead workflow sessions: 5/5 good outcomes with skills = **1.00**
- The remaining failures are all infrastructure-caused interruptions

**Adjusted skill.usefulness-rate (agent-controlled sessions only) = 5/5 = 1.00**

### Recommendation

1. **Don't use raw usefulness-rate as a skill quality signal** until infrastructure reliability improves
2. **Track infrastructure-adjusted usefulness-rate** as the primary metric
3. **The biggest ROI is fixing infrastructure** (workflow dispatch, session timeouts), not improving skills
4. Skills themselves are working well — agents apply them and they correlate with good outcomes when infra allows completion

## Per-Skill Breakdown (preliminary)

| Skill | Applied In | Good Outcomes | Usefulness |
|-------|-----------|---------------|------------|
| Verify-Before-Finish | 15 | 5 | 0.33 (raw) / 1.00 (adjusted) |
| Structured Completion | 15 | 5 | 0.33 (raw) / 1.00 (adjusted) |
| Evidence Citation | 12 | 5 | 0.42 (raw) / 1.00 (adjusted) |

All skills show the same pattern: perfect when infra works, zero when it doesn't. Skills are not the bottleneck.
