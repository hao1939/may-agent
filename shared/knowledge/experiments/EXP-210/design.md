# EXP-210: Schema-Organized Context vs. Flat List Context

**Date**: 2026-06-28
**Status**: DESIGNED
**Hypothesis**: H-077 (Schema-Organized Context Activates Knowledge Better Than Flat Lists)
**Predecessor**: H-EXP-012 (75% known-but-violated rate), EXP-164 (information provision works)

---

## Research Question

Does restructuring an agent's context.md from a flat list of facts into schema-organized sections (with trigger conditions and cross-references) reduce knowledge-activation failures?

## Background

H-EXP-012 found that 6/8 mid-session errors violated facts already present in context.md — a 75% "known-but-violated" rate. The problem isn't missing knowledge; it's failing to activate knowledge at the right moment. H-077 proposes that schema organization with trigger conditions creates stronger situation→fact associations.

## Design

### Arms

**Arm A (Control)**: Current flat-list context.md format.
```
- Always run tests before committing
- Use edit() not sed for file changes  
- Check .state/ for checkpoints before starting
```

**Arm B (Treatment)**: Schema-organized context.md with trigger conditions and cross-refs.
```
## [Before Committing Code]
Trigger: about to run `git commit` or call finish(success) after code changes
- Run full test suite first (see also: [Tool Selection])
- Verify no untracked files with `git status`

## [Tool Selection]  
Trigger: about to modify a file
- Use edit() for small changes (safer than sed — no accidental data loss)
- Use write() only for new files or full rewrites
- Cross-ref: [Before Committing Code] — run tests after edits
```

### Scenario

Use an existing gym scenario where agents commonly violate known facts. Best candidate: a coding task requiring git operations + file edits (exercises both tool selection and git rules).

### Protocol

1. Select 2 gym scenarios where baseline agents commonly violate context.md facts
2. Run each arm 5 times per scenario (N=10 per arm, 20 total)
3. Score: count of knowledge-activation violations per session (primary), task success (secondary)

### Metrics

- **Primary**: Knowledge-activation violations per session (lower is better)
- **Secondary**: Task completion rate
- **Tertiary**: Time-to-first-violation (later is better)

## Predictions

- H-077 predicts: violations drop >40% in Arm B vs Arm A
- Compound errors (requiring 2+ facts) drop more than single-fact errors
- Null: <15% difference → schema structure doesn't help

## Cost

~$10-15 (20 gym runs at ~$0.50-0.75 each)

## Dependencies

Requires gym infrastructure for controlled runs.
