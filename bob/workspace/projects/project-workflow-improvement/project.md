# Project: Project Workflow Improvement

**Status**: active
**Owner**: bob
**Priority**: P1
**Iteration**: 0
**Health**: —

## Goal
Continuously improve the project workflow by testing changes on live projects and measuring outcomes. The project workflow is the core orchestration mechanism — small improvements compound across all projects.

## Metrics
- project.stall-rate: target < 20% (iterations without milestone progress / total iterations)
- project.false-done: target < 5% (evaluator rejects / total DONE claims)
- project.iterations-to-complete: target < 10 avg (fewer iterations = more efficient)

## How This Works

This is a **learning project** — it doesn't end. It follows a cycle:

```
Observe metrics → Identify weakness → Design experiment → Test on live project → Measure → Adopt or reject
```

### Experimentation method

1. **Pick a feature to test** (e.g., rich Current State, reviewer improvements)
2. **Pick a live project to test it on** (active project with enough iterations ahead)
3. **Add a `## Process Notes` section to that project** with the experimental instructions
4. **Run 3-5 iterations** with the feature
5. **Measure**: did iterations-to-milestone improve? Did stall rate drop? Did worker quality improve?
6. **Compare to baseline**: same project type without the feature
7. **Adopt into workflow code if positive, reject with evidence if not**

### Feature backlog (ideas to test)

| Feature | Hypothesis | Test on |
|---------|-----------|---------|
| Rich Current State | Reviewer synthesis in Current State reduces worker confusion | breadcrumb-gap (tested, positive signal) |
| Reviewer as problem-solver | Stronger reviewer prompt ("you are the problem-solver, not evaluator") | convention-compliance |
| Worker context budget | Limit recent journal to 2 entries instead of 3 — less noise | next new project |
| Milestone auto-scope | When stalled 3x, reviewer auto-simplifies the stuck milestone | prove-the-loop |
| Evaluator leniency tuning | Score threshold 6 instead of 7 — fewer false rejections | next project with evaluator loops |
| Project-specific reviewer instructions | `## Process Notes` section guides reviewer behavior | any project |

## Milestones
- [ ] Baseline: measure current stall-rate, false-done rate, iterations-to-complete across all projects
- [ ] First experiment: test one feature on a live project, measure before/after
- [ ] Second experiment: test a different feature, compare
- [ ] Adopt: merge winning features into the workflow code
- [ ] Metrics dashboard: stall-rate and false-done visible in web UI

## Current State
Not started.

## Iteration Summary

## Comments
- [2026-04-22 hao] This is a meta-project — it improves the system that runs all other projects. Use live projects as test subjects. The `## Process Notes` section in a project file is the hook for per-project experiments. Measure everything, adopt what works.
