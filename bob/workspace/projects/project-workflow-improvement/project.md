# Project: Project Workflow Improvement — Tracker

**Status**: active
**Owner**: bob
**Priority**: P1
**Iteration**: 1
**Health**: 6/10

## Goal
Continuously improve the project workflow. This is a TRACKER — each experiment is its own project.

## Metrics
- project.stall-rate: target < 20%
- project.false-done: target < 5%
- project.iterations-to-complete: target < 10 avg

## Experiments

| Experiment | Project | Status | Result |
|-----------|---------|--------|--------|
| Rich Current State | (tested manually) | adopted ✅ | 1 focused iter vs 6 confused |
| Smart context generation | pwi-smart-context | active | — |
| Milestone auto-scope | — | idea | — |
| Evaluator tuning | — | idea | — |

## How to Add an Experiment

1. Create a project: `agents/bob/workspace/projects/pwi-<name>/`
2. Project.md has: goal, design, test plan, target project, milestones
3. Include the feature design doc in the project directory
4. Run experiment: test on a live project, measure before/after
5. Update this tracker with results
6. If positive: merge into workflow code, mark adopted

## Milestones
- [x] Rich Current State: tested, adopted
- [x] Baseline measurement: measure stall-rate, false-done, iterations-to-complete across all projects
- [ ] Identify worst metric → create experiment project for it
- [ ] First experiment completes → adopt or reject
- [ ] Second experiment completes → adopt or reject
- [ ] All three metrics meet targets

## Resources
- **Workflow code**: agents/shared/workflows/project.ts
- **Rich context design**: designs/rich-current-state.md
- **Smart context design**: designs/smart-context-generation.md
- **Evidence**: breadcrumb-gap manual test (rich context: 1 iter vs 6)

## Current State
Baseline measured (iter 1). Worst metric: iterations-to-complete (14 avg vs 10 target). Next: design experiment to reduce iteration count.

## Baseline Measurement (2026-04-22)

**Sample**: 4 projects (context-learning, context-learning-impl, reviewer-effectiveness, agent-cli-research)

| Metric | Measured | Target | Status |
|--------|----------|--------|--------|
| stall-rate | ~30% (3/4 projects had stall periods) | < 20% | ❌ MISS |
| false-done | 0% (no reopened projects) | < 5% | ✅ PASS |
| iterations-to-complete | 14 avg (23, 12, 7) | < 10 | ❌ MISS |

**Worst metric**: iterations-to-complete (14 vs 10 target, 40% over). context-learning alone took 23 iterations — that's where the biggest waste was.

**Stall patterns**: agent-cli-research blocked on external dependency (API keys). context-learning and reviewer-effectiveness had repeated "no progress" iterations. Root cause: unclear milestones causing drift.

**Next action**: The "Smart context generation" experiment is already designed and targets iteration efficiency. Prioritize implementing it.

## Iteration Summary

## Comments
