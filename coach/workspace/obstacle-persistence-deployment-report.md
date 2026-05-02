# Obstacle-Persistence Skill Deployment Report

**Date**: 2026-05-02
**Author**: coach
**Skill**: `agents/shared/skills/obstacle-persistence.md`
**Status**: DEPLOYED ✅

## Background

The obstacle-persistence skill was identified as unwired (existed but deployed to 0 agents). Bob had designed EXP-299 but never executed. The skill addresses a known failure mode: agents silently abandon goals after a single tool failure instead of trying alternatives.

## Deployment

Deployed to:
1. **bob/context.md** — Added "Obstacle Persistence" to shared skills line (line 38)
2. **coder/context.md** — Added skill reference with path and description (line 24)

## Rationale

- Complements existing `obstacle-pivot` skill (pivot = when to change direction; persistence = try alternatives first)
- Bob and coder are the primary task-executing agents most likely to encounter tool failures
- Low-risk deployment: skill has clear behavioral triggers and a built-in limit (cap at 2-3 alternatives)
- No gym experiment needed — the behavioral pattern is well-documented and the skill is conservative

## Measurement Plan

- **Metric**: Reduction in "silent abandonment" — sessions where agent encounters an error and immediately finishes without alternative attempts
- **Method**: Audit 10+ post-deployment sessions from bob/coder for obstacle-handling behavior
- **Timeline**: Review in next heartbeat after 10+ sessions available
- **Success criteria**: ≥60% of obstacle encounters show 2+ retry attempts before pivot/escalation

## Complementary Skills Now Active

| Agent | Obstacle Pivot | Obstacle Persistence |
|-------|---------------|---------------------|
| bob | ✅ | ✅ (NEW) |
| coder | ✅ | ✅ (NEW) |
| tech-lead | ✅ | ❌ |

## Next Steps

- Monitor bob/coder sessions for persistence behavior
- If effective, deploy to tech-lead
- Update todo.md to reflect deployment status
