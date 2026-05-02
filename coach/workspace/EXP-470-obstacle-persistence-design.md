# EXP-470 — Obstacle-Persistence Skill Gym Measurement

**Date**: 2026-05-02
**Status**: DESIGN
**Author**: coach
**Skill**: `agents/shared/skills/obstacle-persistence.md`
**Deployed to**: bob, coder (2026-05-02)

## Problem

Obstacle-persistence skill deployed but never measured in gym. Need to verify it produces measurable behavioral change (agents try 2+ alternatives before abandoning/pivoting).

## Hypothesis

With obstacle-persistence skill loaded, agents will show ≥2 distinct retry attempts when encountering tool failures, compared to baseline where agents may retry 0-1 times.

**Target**: Treatment arm shows persistence behavior in ≥67% of trials (2/3).

## Design

### Scenario: `obstacle-persistence-multi-failure`

A task where the agent encounters **3 sequential obstacles** that each require different approaches:

1. **File read fails** — config.yaml has a syntax error (reuse from existing scenario)
2. **Write target directory doesn't exist** — must create it
3. **A required dependency file is misnamed** — must discover correct name via ls/find

### Success Criteria (per trial)
- `retry_attempts`: Agent makes ≥2 distinct approaches per obstacle (not just re-running same command)
- `goal_completed`: Agent produces final output despite obstacles
- `no_silent_abandon`: Agent doesn't skip any of the 3 sub-tasks
- `explicit_documentation`: Agent states what failed and what alternative it tried

### Arms
- **Baseline**: No obstacle-persistence skill in context
- **Treatment**: obstacle-persistence skill loaded via coaching/my-instructions.md

### Trials
- 3 per arm = 6 total gym runs

## Method

1. Create scenario at `agents/gym/scenarios/obstacle-persistence-multi-failure/`
2. Run 3 baseline trials (no skill)
3. Run 3 treatment trials (skill loaded)
4. Score each trial on 4 checks above
5. Compare pass rates

## Success Criteria for Experiment
- Treatment ≥ baseline + 20pp on `retry_attempts` check
- OR treatment ≥67% on `goal_completed` vs baseline ≤33%

## Next Steps
1. ~~Build the gym scenario (environment + task + success_criteria.js)~~ ✅ DONE (2026-05-02)
   - Scenario: `agents/gym/scenarios/obstacle-persistence-multi-failure/`
   - Obstacles: YAML syntax error, missing output/ dir, validator path mismatch
   - 8 checks: 3 product, 4 behavioral, 1 efficiency
2. Run baseline arm (3 trials, no skill)
3. Run treatment arm (3 trials, obstacle-persistence skill loaded)
4. Write results
