# Project: Project Workflow Improvement

**Status**: active
**Owner**: bob
**Priority**: P1
**Iteration**: 1
**Health**: 6/10

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
- [x] Baseline: measure current stall-rate, false-done rate, iterations-to-complete across all projects
- [ ] First experiment: test one feature on a live project, measure before/after
- [ ] Second experiment: test a different feature, compare
- [ ] Adopt: merge winning features into the workflow code
- [ ] Metrics dashboard: stall-rate and false-done visible in web UI

## Current State

### Baseline (measured 2026-04-22, 20 projects with iteration data)

| Metric | Value | Notes |
|--------|-------|-------|
| **Avg iterations/milestone** | **3.0** | Range: 0.6 (metric-reaction-investigation) to 8.5 (adaptive-heartbeats) |
| **Milestone completion rate** | **54%** (85/157) | Many projects close as "done" with milestones incomplete |
| **Low-completion projects** | **5/20 (25%)** | <50% milestones completed before close |
| **Worst offenders** | reviewer-effectiveness (0%), convention-compliance (24%), prove-the-loop (33%) | Pattern: ambitious milestone scoping |

**Key findings:**
1. **Milestone over-scoping is the #1 problem.** Projects define 10-25 milestones but complete <50%. This suggests milestones aren't right-sized.
2. **3.0 iters/milestone is decent** — but the distribution is bimodal. Simple projects (optimizer, tech-lead) average ~1.5; complex ones (coach, bob) average ~5.0.
3. **prove-the-loop at 39 iterations** is the biggest outlier — 6/18 milestones after 39 iters = chronic stall.

**Next experiment:** Test "Reviewer as problem-solver" on the next active project (coach/prove-the-loop is a candidate — it's stalling and could benefit from a reviewer prompt that synthesizes blockers instead of just scoring).

## Iteration Summary

## Comments
- [2026-04-22 hao] This is a meta-project — it improves the system that runs all other projects. Use live projects as test subjects. The `## Process Notes` section in a project file is the hook for per-project experiments. Measure everything, adopt what works.
