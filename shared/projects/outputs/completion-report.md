# System Efficiency Project — Completion & Regression Report

**Date**: Generated automatically  
**Status**: ✅ COMPLETE

## Core Agent Metrics (All Pass)

| Agent | SOUL.md | context.md |
|-------|---------|------------|
| master | 344w ✅ | 184w ✅ |
| arc | 418w ✅ | 194w ✅ |
| amy | 329w ✅ | 236w ✅ |
| bob | 420w ✅ | 256w ✅ |
| scout | 303w ✅ | 85w ✅ |
| coach | 367w ✅ | 307w ✅ |
| dev | 357w ✅ | 180w ✅ |
| tech-lead | 358w ✅ | 268w ✅ |
| may | 598w ✅ | 301w ✅ |
| evaluator | 406w ✅ | 196w ✅ |
| optimizer | 299w ✅ | 340w ✅ |
| judge | 346w ✅ | 176w ✅ |
| qa | 474w ✅ | 277w ✅ |
| coder | — | 186w ✅ |

**SOUL.md avg**: ~386w (target <600w) — ✅  
**context.md avg**: ~218w (target <450w) — ✅

## Non-Core Files Over Limit (Informational)

These are in `.lab/`, `gym/forks/`, or `_archetypes/` — outside project scope:

- `.lab/amy-env-orientation/SOUL.md` — 912w (lab experiment)
- `gym/forks/coder-identity-refine-ambiguous/SOUL.md` — 1040w (gym fork)
- `_archetypes/scout/SOUL.md` — 601w (archetype template)
- `_archetypes/coach/SOUL.md` — 750w (archetype template)
- `.lab/amy-env-orientation/context.md` — 618w (lab experiment)
- `.lab/coder-verify-gate/context.md` — 1157w (lab experiment)

## Regression Guard

A script at `regression-guard.sh` (in this directory) can be run to detect if any file grows back above limits. Exit code 0 = all clear, 1 = regression found.

## Remaining Low-Priority Item

2 duplicate rules exist across 5 agents — tracked as separate tech-lead task.
