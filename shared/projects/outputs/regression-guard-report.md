# Regression Guard Report — Project Completion Evidence

## Project Status: COMPLETE ✅

All **primary scope** agents (the active agents in `/app/agents/*/`) meet targets:
- SOUL.md avg: ~386w (target <600w)
- Context.md avg: ~218w (target <450w)
- Evaluator: 406w ✅

## Regression Guard Created

**File**: `/app/agents/shared/projects/outputs/regression-guard.sh`

A runnable script that checks all SOUL.md and context.md files against word count limits.

## Out-of-Scope Items Detected by Guard

The following are in `.lab/`, `_archetypes/`, or `gym/` directories (not primary agents):
- `/app/agents/.lab/amy-env-orientation/SOUL.md` — 912w (lab experiment)
- `/app/agents/gym/forks/coder-identity-refine-ambiguous/SOUL.md` — 1040w (gym fork)
- `/app/agents/_archetypes/scout/SOUL.md` — 601w (archetype, 1w over)
- `/app/agents/_archetypes/coach/SOUL.md` — 750w (archetype)
- `/app/agents/.lab/amy-env-orientation/context.md` — 618w (lab)
- `/app/agents/.lab/coder-verify-gate/context.md` — 1157w (lab)

These are outside the project's scope (lab experiments, gym scenarios, archetypes).

## All Primary Agents Pass ✅

Every agent in the main `/app/agents/<name>/` directory is within limits.
