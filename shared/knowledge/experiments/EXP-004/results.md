# EXP-004 Results: Plan-once-amend Skill on Blocker Handling

**Hypothesis**: H-004 — Installing plan-once-amend skill improves `handles-blocker-efficiently` pass rate
**Status**: Complete
**Verdict**: NO EFFECT — Hypothesis refuted

## Setup

- **Scenario**: plan-once-amend (gym)
- **Agent**: coder
- **Control**: No skill installed
- **Treatment**: plan-once-amend skill installed
- **Runs per arm**: 3

## Results

| Arm | Run | Score | handles-blocker-efficiently | Duration (s) |
|-----|-----|-------|-----------------------------|--------------|
| Control | 1 | 8/8 | ✅ Pass | 174 |
| Control | 2 | 7/8 | ❌ Fail | 119 |
| Control | 3 | 7/8 | ❌ Fail | 277 |
| Treatment | 1 | 8/8 | ✅ Pass | 105 |
| Treatment | 2 | 7/8 | ❌ Fail | 113 |
| Treatment | 3 | 7/8 | ❌ Fail | 182 |

### Primary Metric: handles-blocker-efficiently
- **Control**: 1/3 (33%)
- **Treatment**: 1/3 (33%)
- **Delta**: 0%

### Overall Pass Rate
- **Control**: 1/3 (33%)
- **Treatment**: 1/3 (33%)
- **Delta**: 0%

## Analysis

The plan-once-amend skill had zero measurable effect. Both arms showed identical 1/3 pass rates.

**Root cause**: The failing check measures whether the agent spends ≤3 tool operations searching for a missing `health-check.ts` file. The skill teaches plan tracking ("don't redeclare your plan") but doesn't address the search-obsession behavior. The agent's tendency to keep trying `read`, `find`, `ls` for missing files is a tool-calling habit, not a planning-structure issue.

**Key insight → KE-006**: Skills targeting reasoning patterns don't change tool-calling patterns. The skill text says "mark blocked and move on" but the agent *knows* this — it just can't stop retrying. The intervention needs to operate at the tool-calling level (framework guards, retry limits, environment signals), not the text level.

## Date
2026-04-01
