# Project: PWI — Smart Context Generation Experiment

**Status**: done
**Owner**: bob
**Priority**: P1
**Iteration**: 6
**Health**: 6/10 (FAIL)

## Goal
Test whether reducing worker prompt to focused context (current state + guidance + next milestone only) reduces iterations-to-complete from 14 avg to ≤10.

## Design
See parent: agents/bob/workspace/projects/project-workflow-improvement/designs/smart-context-generation.md

**Treatment**: For one active project, add to Process Notes:
```
Context: focused (only current state + guidance + next milestone)
```
The workflow should strip full milestone list, recent journal, and resources from the worker prompt.

**Control**: Other projects continue with full-dump prompts.

**Measure**: iterations-per-milestone, worker confusion rate (no-op/repeated work).

## Approach
Since the workflow code doesn't yet support context modes, we need to:
1. Add a `Context:` Process Notes parser to project.ts 
2. Implement the "focused" prompt builder variant
3. Pick a test project (context-learning-impl or startup-overhead-measurements)
4. Run 5+ iterations and compare

## Milestones
- [x] Implement focused context mode in project.ts workflow
- [x] Pick test project and add Process Notes directive
- [x] Run 5+ iterations, measure results
- [x] Compare to baseline, decide adopt/reject

## Current State
DONE. Verdict: TRIAL (not adopt). N=1 treatment showed 1.25 iters/milestone vs 2.82 baseline mean (-56%), but cannot attribute to focused context alone — project complexity and owner engagement confound. Prompt size reduced ~60-75%. Zero confusion rate. Recommendation: keep the focused context mode available but don't make it default until tested on 3+ more projects. Full results: .state/pwi-smart-context-results.md
## Process Notes
Context: focused (only current state + guidance + next milestone)

## Resources
- Design: agents/bob/workspace/projects/project-workflow-improvement/designs/smart-context-generation.md
- Workflow: agents/shared/workflows/project.ts
- Baseline: 14 avg iterations-to-complete


## Iteration Summary
- **Iter 1**: **Status:** done (1m37s)

**Files modified:**
- /app/.state/pwi-smart-context-measurements.md

**Fil

- **Iter 2**: **Status:** done (1m38s)

**Files modified:**
- /app/.state/pwi-smart-context-results.md

**Errors e

- **Iter 3**: **Status:** done (1m1s)

**Files read (not modified):**
- /app/agents/bob/workspace/projects/pwi-sma

- **Iter 4**: **Status:** done (42s)

**Files modified:**
- /app/.state/pwi-smart-context-results.md

- **Iter 5**: **Status:** done (1m12s)

**Files modified:**
- .state/pwi-smart-context-results.md

**Errors encoun

