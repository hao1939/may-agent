# Project: Project Workflow Improvement — Tracker

**Status**: active
**Owner**: bob
**Priority**: P1
**Iteration**: 0
**Health**: —

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
| Smart context generation | pwi-smart-context (not created) | designed | — |
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
- [ ] Baseline measurement: stall-rate, false-done, iterations-to-complete across all projects
- [ ] Smart context generation: design → test → measure
- [ ] Next experiment based on findings

## Resources
- **Workflow code**: agents/shared/workflows/project.ts
- **Rich context design**: designs/rich-current-state.md
- **Smart context design**: designs/smart-context-generation.md
- **Evidence**: breadcrumb-gap manual test (rich context: 1 iter vs 6)

## Current State
Rich Current State adopted. Next: baseline measurement, then smart context experiment.

## Iteration Summary

## Comments
