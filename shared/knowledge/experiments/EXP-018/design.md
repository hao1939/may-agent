# EXP-018: Structured-Plan-Writing Skill on plan-once-amend Scenario

**Date**: 2026-04-03
**Status**: DESIGNED
**Owner**: Coach

## Hypothesis

The `structured-plan-writing` skill, when injected as text into the coder agent's system prompt, will improve blocker-handling on the `plan-once-amend` scenario. Specifically, the risk-identification step (Step 3: RISK) will cause the agent to anticipate that files might not exist, so when health-check.ts is missing, the agent will pivot faster (≤3 ops) instead of perseverating.

**Baseline**: 7/8 (fails: handles-blocker-efficiently — agent spends >3 ops on missing health-check.ts)

## Experimental Design

| Arm | Scenario | Agent | Skill Injection | N |
|-----|----------|-------|----------------|---|
| Baseline | plan-once-amend | coder | none (historical: 7/8) | 1 (historical) |
| Treatment | plan-once-amend | coder | structured-plan-writing text injection | 2 |

**Why this scenario**: 
- Non-ceiling baseline (7/8) with a clear behavioral gap
- The failing check (handles-blocker-efficiently) directly maps to the skill's Step 3 (RISK: anticipate what could go wrong, have fallback)
- The scenario also tests plan discipline, which the structured-plan-writing skill complements

**What structured-plan-writing adds over baseline**:
1. DECOMPOSE: Agent should write atomic steps (already likely doing this)
2. ORDER: Agent should note dependencies (health-check fix blocks runbook update content, but not the other items)
3. RISK: Agent should note "file might not exist → search/skip" for health-check.ts
4. CHECKPOINT: Agent should verify intermediate results
5. WRITE IT DOWN: Full structured plan before acting

The key lever is Step 3 (RISK). If the agent explicitly writes "Risk: file might not exist → mark blocked and move on" during planning, it should naturally spend fewer ops when the blocker materializes.

## Success Criteria

- **Pass**: Treatment scores 8/8 on at least 1 of 2 runs (handles-blocker-efficiently passes)
- **Strong pass**: Treatment scores 8/8 on both runs

## Caveat

Given EXP-016/017 meta-analysis (0/19 text-injection successes), expectations are low. However:
1. This is a milder behavioral gap (7/8, not 1/3)
2. The skill targets planning discipline, not judgment restraint
3. The failure mode (perseverating on missing file) is more "procedural" than "fixer-prior"

This makes it a fairer test of text injection than judgment scenarios.
