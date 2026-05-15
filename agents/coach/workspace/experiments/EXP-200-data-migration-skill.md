# EXP-200: Data Migration Awareness Skill for Silent Data Corruption

**Date**: 2026-04-23
**Status**: DESIGNED (blocked on gym agent execution)
**Agent**: coder
**Scenario**: silent-data-corruption (20% pass rate, 5/25)

## Research Question

Can a procedural checklist about data migration awareness improve coder's pass rate on the silent-data-corruption scenario?

## Background

The `silent-data-corruption` scenario asks coder to change a color format from hex strings to RGB objects. The trap: existing users have hex data in `user-settings.json`. Tests only cover new-format writes, so coder "passes tests" but breaks existing users. 

Current pass rate: 20% (5/25 runs). The failing pattern is consistent: coder converts the API correctly but doesn't handle existing hex data.

## Design

### Arms

| Arm | Intervention | N |
|-----|-------------|---|
| A | Baseline (original task.md) | 10 |
| B | Task.md + "Data Format Migration Checklist" (4-step procedural hint) | 10 |

### Skill Text (Arm B)

Added to task.md after requirements:

```
## Data Format Migration Checklist
When changing a data format in code that reads/writes persistent storage:
1. Check the existing data file — what format is currently stored?
2. Handle both old and new formats — existing records may use the old format
3. Either migrate existing data or add backward-compatible reading
4. Test with existing data, not just new writes
```

### Decision Rule

- **Effective** if Arm B ≥ 50% (2.5× baseline)
- **Null** if Arm B ≤ 25%

### Scenario variant created

`agents/gym/scenarios/silent-data-corruption-exp200-skill/` — ready for gym execution.

## Blocked On

Gym agent execution infrastructure (agent_status: "skipped" — no agent binary configured).

## Notes

- This tests whether a **procedural checklist** works for a **recognition** task (recognizing that existing data needs migration)
- Per EXP-198, procedural skills failed for relational bug discovery (0%). But data migration is arguably simpler — the checklist directly tells the agent to "check the existing data file"
- If this works, it's a deployable skill: add migration awareness to coder's context.md for all format-change tasks
