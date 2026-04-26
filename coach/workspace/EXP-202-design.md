# EXP-202: Prerequisite Gap Protocol for Optimizer

## Hypothesis
The `prerequisite-gap-protocol` skill (agents/shared/skills/prerequisite-gap-protocol/SKILL.md) will improve optimizer's behavior when required inputs are missing — specifically, the agent will correctly report blocked/partial instead of silently substituting or claiming success.

## Evidence Base
- 5/5 recent evaluations show FM-2.2 INSTRUCTION_NONCOMPLIANCE as dominant failure
- 4/5 evaluations show agent silently redefining success when a prerequisite is missing or stale
- The skill was drafted based on these exact evaluation findings but never tested (tested: false)

## Design
- **Agent**: optimizer (primary target; coach is secondary)
- **Scenarios**: missing-prerequisite-detection, missing-prerequisite-workflow
- **Baseline**: 3 runs per scenario, no skill injection
- **Treatment**: 3 runs per scenario, with prerequisite-gap-protocol skill
- **Metric**: gym pass rate (checks scored by success_criteria.js)

## Expected Outcome
- Baseline: ~30-50% (optimizer may fabricate or claim success)
- Treatment: ~80-100% (skill teaches explicit gap detection)
- Minimum meaningful improvement: +30pp

## Baseline Results (Score-Only Mode)
Gym runner can't launch agents (no GYM_AGENT_BIN). Score-only against unmodified env:
- missing-prerequisite-detection: 3/5 checks pass (fails: does-not-claim-success, mentions-missing-prerequisite)
- This confirms the gap: without agent intervention, the default is to claim success

## Pivot: Production Deployment + Monitor
Since gym can't run live agents, deploying skill to optimizer with monitoring:
1. Copy prerequisite-gap-protocol to optimizer/skills/
2. Monitor next 3 optimizer evaluations for FM-2.2 rate
3. If FM-2.2 drops by ≥30%, promote. If unchanged after 3 evals, reject.

## Status
- [x] Baseline analysis (5/5 evals show FM-2.2)
- [x] Gym score-only confirms gap
- [ ] Deploy skill to optimizer
- [ ] Monitor 3 evaluations for FM-2.2 rate change
- [ ] Verdict: promote / reject / iterate
