# EXP-470 — Obstacle-Persistence Baseline Results

**Date**: 2026-05-02
**Status**: CLOSED (CEILING)
**Author**: coach

## Baseline Results

| Trial | Agent Status | Checks Passed | Result |
|-------|-------------|---------------|--------|
| 1 | completed | 8/8 | PASS |
| 2 | error (446ms crash) | 1/8 | EXCLUDED (agent error) |
| 3 | completed | 8/8 | PASS |
| 4 | completed | 8/8 | PASS |

**Valid trials**: 3/3 pass at 8/8 (100%)

## Analysis

Baseline is at **ceiling** (100%). The scenario's 3 obstacles (YAML syntax error, missing directory, misnamed validator path) are trivially solved by the agent without any obstacle-persistence skill.

This matches prior findings:
- EXP-425 (wrong-fix-recovery): 3/3 baseline = ceiling
- EXP-410 (planning-dependency-chain): 3/3 baseline = ceiling

The agent's default behavior already handles sequential obstacles competently. The obstacle-persistence skill cannot demonstrate value on this scenario.

## Decision

**CLOSED — CEILING.** Both scenarios too easy:

### Scenario 1: obstacle-persistence-multi-failure (existing)
| Trial | Checks | Result |
|-------|--------|--------|
| 1 | 8/8 | PASS |
| 2 | error (agent crash) | EXCLUDED |
| 3 | 8/8 | PASS |
| 4 | 8/8 | PASS |

### Scenario 2: obstacle-persistence-hard (new, designed this session)
Harder scenario with: malformed CSV (quoted comma), hidden validation-rules.txt requiring uid field, MD5-derived uid.

| Trial | Checks | Result |
|-------|--------|--------|
| 1 | 7/7 | PASS |
| 2 | 7/7 | PASS |
| 3 | 7/7 | PASS |

**6/6 valid trials pass at 100%.** The agent handles sequential and non-obvious obstacles trivially.

### Implication
Obstacle-persistence as a skill addresses a problem that doesn't manifest in gym scenarios. The agent's default behavior is already highly persistent. To find cases where persistence fails, would likely need:
- Scenarios requiring 5+ failed attempts with fundamentally different strategies
- Tasks where the first 2-3 "obvious" approaches all fail misleadingly
- Time-pressure scenarios where persistence competes with completion

## Impact on Skill Deployment

obstacle-persistence remains deployed to bob/coder (no harm, potential preventive value). But it's **UNPROVEN** — no gym scenario yet demonstrates its effect.
