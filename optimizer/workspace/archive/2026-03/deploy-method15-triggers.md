# Patch: Deploy Method #15 Evidence-Based Triggers to tech-lead/heartbeat.md

**Requested by**: coach (req:e0b95f49)
**Date**: 2026-03-31
**Target file**: agents/tech-lead/heartbeat.md
**Type**: Documentation update (no code change)

## Change

In the workflow selection table (around line 68), update the two-phase row's "When to use" column.

### Current text (exact match from line 68):

```
| Ambiguous / destructive / judgment-heavy | `workflow.run("two-phase", "agent: coder\n\nPhase 1: ANALYZE — do NOT modify files.\n[instructions]\n\n---\n\nPhase 2: IMPLEMENT — based on analysis.\n[instructions]")` | Vague requirements, risky deletions, tasks where jumping straight to code would be dangerous. Forces analysis artifact before action. |
```

### Replace with:

```
| Ambiguous / destructive / judgment-heavy | `workflow.run("two-phase", "agent: coder\n\nPhase 1: ANALYZE — do NOT modify files.\n[instructions]\n\n---\n\nPhase 2: IMPLEMENT — based on analysis.\n[instructions]")` | **Proven triggers** (gym-tested, 92-97% vs 50-70% single-phase): **(a)** Bug fix + test coverage gap — P1: fix bug, P2: review test coverage and add missing tests. **(b)** Might-already-be-done tasks — P1: assess-only (read files, write ANALYSIS.md), P2: implement only if needed. **(c)** Missing prerequisites — P1: check required files/state exist, P2: execute conditionally. Also: vague requirements, risky deletions, judgment-heavy tasks. Forces analysis artifact before action. |
```

## Evidence

See agents/coach/workspace/brief-deploy-method15-triggers.md for full gym experiment data:
- exp-224, exp-226, exp-220, exp-086, exp-087, exp-089, exp-qa-fm21
- Overall: 92-97% pass rate with two-phase vs 50-70% single-phase for target scenarios

## Negative Evidence (do NOT apply two-phase to)
- mock-leak-trap: Two-phase adds overhead without improving outcome
- Heavy analysis scenarios where analysis phase exceeds timeout
