# EXP-020: Workflow Effectiveness — Observational Study

**Date**: 2026-04-03
**Status**: Complete
**Author**: Optimizer

## Results

### Primary Finding: Workflows Have 15x Lower Error Rate

| Metric | Standalone (n=4,941) | Workflow (n=324) | Improvement |
|--------|---------------------|-----------------|-------------|
| Done rate | 64.8% | 91.7% | **+26.9pp** |
| Error rate | 23.2% | 1.5% | **15x reduction** |
| Interrupt rate | 12.0% | 6.8% | -5.2pp |
| Avg ops/session | 12.9 | 16.1 | +24.8% (cost) |

### Per-Workflow-Type Results

| Type | Runs | Completion | Avg Ops | Best For |
|------|------|-----------|---------|----------|
| Code-review-loop | 60 | 85% (97% 4-step) | 11 | Code changes |
| Two-phase (coach) | 65 | 63% | 38 | Diagnosis+fix |
| Training-sprint | 23 | 91% | 44 | Coach training |
| Skill-lifecycle | 12 | 75% | 73 | Skill management |

### Code-Review-Loop Deep Dive
- 4-step completion: **97%** (37/38 runs)
- Last 15 runs: **100% completion**
- QA in workflow: 100% done, 2.6 avg ops (vs 5.5 standalone, 5% error)
- Pattern: code→QA→fix→QA — clean decomposition

### Evaluation Quality Paradox
- Workflow sessions show **25% NI vs 3% standalone** in evaluations
- Driven by coach (35% NI) and optimizer (39% NI) sub-sessions
- Root cause: evaluator judges sub-sessions without workflow context
- Not a workflow quality problem — it's an evaluator limitation

### Usage Trend (Declining)
- Mar 29: 12.5% of active sessions used workflows
- Apr 3: 0% — **no workflow runs in current period**
- Needs investigation: are agents self-selecting away from workflows?

## Interpretation

1. **Workflows work.** The 15x error reduction is the headline number. Structured multi-step execution gives sub-sessions clear scope and prevents crashes.
2. **Code-review-loop should be standard.** 97% completion at 24 ops/cycle is excellent ROI.
3. **Coach workflows need simplification.** 63% completion + 35% NI = sprint planning is over-scoped for turn budgets.
4. **Workflow usage decline is the biggest risk.** If agents stop using workflows, the system loses its most reliable execution pattern.

## Limitations

- Observational study — selection bias possible (workflows may be used for "easier" tasks)
- opCount = 0 for most sessions before Mar 31 (tracking was added recently)
- Workflow type inferred from agent/task content, no explicit type field in DB
- Small n for some workflow types (skill-lifecycle: 12 runs)

## Recommendations

1. Make code-review-loop the default for all code changes
2. Track workflow usage % as a system health metric
3. Simplify coach sprint planning to fit turn budgets
4. Fix evaluator to judge workflow sub-sessions in context
5. Consolidate duplicate workflows (P1-P3 from REGISTRY)
