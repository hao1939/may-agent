# Project: Project Workflow Improvement

**Status**: active
**Owner**: bob
**Priority**: P1
**Iteration**: 0
**Health**: —

## Goal
Continuously improve the project workflow by testing changes on live projects and measuring outcomes.

## Metrics
- project.stall-rate: target < 20% (iterations without progress / total iterations)
- project.false-done: target < 5% (evaluator rejects / total DONE claims)
- project.iterations-to-complete: target < 10 avg

## Milestones
- [ ] Baseline: measure current stall-rate, false-done rate, iterations-to-complete
- [ ] First experiment: test one feature on a live project, measure before/after
- [ ] Second experiment: test a different feature, compare
- [ ] Adopt: merge winning features into workflow code

## Current State
Not started. First experiment candidate: rich Current State (positive signal from breadcrumb-gap manual test).

## Feature Designs

Each feature has a design doc in this project's directory. The design must answer: what changes, how to enable, how to measure, how to revert.

| Feature | Design | Status | Test project |
|---------|--------|--------|-------------|
| Rich Current State | [designs/rich-current-state.md](designs/rich-current-state.md) | Tested manually, positive signal | breadcrumb-gap |
| Process Notes hook | [designs/process-notes.md](designs/process-notes.md) | Not designed | — |
| Milestone auto-scope | [designs/milestone-auto-scope.md](designs/milestone-auto-scope.md) | Not designed | — |
| Evaluator tuning | [designs/evaluator-tuning.md](designs/evaluator-tuning.md) | Not designed | — |

## How to Run an Experiment

1. Write the feature design in `designs/<feature>.md`
2. Pick a live project with enough iterations ahead
3. Add `## Process Notes` to that project with the feature instructions
4. Run 3-5 iterations, measure stall-rate and milestone velocity
5. Compare to baseline (same project before, or similar project without)
6. Document results in `results/<feature>-results.md`
7. If positive: merge into workflow code. If negative: document why and revert.

## Resources
- **Workflow code**: agents/shared/workflows/project.ts
- **Project handler**: agents/may/handlers/project.ts
- **Design docs index**: agents/shared/may-agent-docs/design/project-system.md
- **Evidence**: breadcrumb-gap manual test showed 1 focused iteration vs 6 confused (rich context vs mechanical)
- **Metrics source**: .state/may.db → sessions table (stall detection), events table (project.blocked/completed)

## Process Notes

## Comments
- [2026-04-22 hao] Each feature needs a design doc in designs/. The design must explain: what changes, how to enable on one project, how to measure success, how to revert. Test on live projects, not in theory.
