# Project: PWI — Milestone Auto-Scope Experiment

**Status**: done
**Owner**: bob
**Priority**: P1
**Iteration**: 6
**Health**: 7/10 (PASS)

## Goal
Reduce project stall rate from 30% to <20% by addressing the root cause: unclear milestones causing drift. When milestones are vague or too large, workers don't know when they're done, reviewers can't evaluate progress, and projects stall.

## Problem Evidence
- Stall rate baseline: 30% (3/4 projects had stall periods) vs 20% target
- context-learning: 23 iterations to complete — milestones were vague ("design agent learning system")
- reviewer-effectiveness: repeated "no progress" iterations from unclear scope
- Pattern: projects with specific, verifiable milestones complete faster; vague milestones cause drift

## Hypothesis
If the workflow detects vague milestones and auto-scopes them into specific, verifiable sub-milestones before iteration 1, stall rate will drop below 20%.

## Design

**What "auto-scope" means**: Before the first worker iteration, a scoping pass rewrites milestones to meet these criteria:
1. **Specific deliverable**: names a file, metric, or testable outcome
2. **Verification method**: how the reviewer knows it's done
3. **Bounded scope**: completable in 1-3 iterations

**Treatment options** (pick one after analysis):
- A. **Pre-flight scoping prompt**: Add a "milestone audit" step before iteration 1 that rewrites vague milestones
- B. **Milestone quality gate**: Score each milestone on specificity (1-5), reject projects with avg < 3
- C. **Auto-decompose**: LLM pass that splits "Design X" into "Write design doc for X in path Y" + "Get review from Z"
- D. **Milestone templates**: Per-type templates (research → "Write findings to X", impl → "Code passes test Y")

**Measure**: 
- Primary: stall-rate on new projects using auto-scoped milestones vs historical baseline
- Secondary: iterations-per-milestone on scoped vs unscoped projects

## Test Plan
1. Analyze 5+ completed projects to categorize milestones as vague vs specific
2. Correlate milestone specificity with stall rate and iteration count
3. Pick intervention (A-D), implement in project.ts
4. Test on 2+ new projects, measure stall rate

## Milestones
- [x] Milestone specificity audit: score milestones across 5+ projects, correlate with stalls → .state/milestone-specificity-audit.md
- [x] Root cause confirmed: specificity ≥4.0 → 1.8 iters/ms vs 3.5 for <4.0; vague milestones correlate with high iteration counts (r≈-0.6)
- [x] Design intervention: pick approach, write implementation plan
- [x] Implement and test on 2+ projects

## Blocked Project Opportunities
These blocked projects could serve as test beds (zero downside per Hao's guidance):
- agent-cli-research (blocked on API keys — if unblocked, test with auto-scoped milestones)
- context-learning-impl (227 consecutive skips — could restart with scoped milestones)
- tech-lead/auto-resume (56 consecutive skips — investigate blocker, test intervention)

## Resources
- Workflow code: agents/shared/workflows/project.ts
- Parent tracker: agents/bob/workspace/projects/project-workflow-improvement/project.md
- Baseline data: PWI project baseline measurement (2026-04-22)
- Smart context results: .state/pwi-smart-context-results.md


## Current State
Complete. 4/4 milestones. — All 4 milestones are complete:

1. **Audit existing milestones across 5+ projects** — `.state/mile
## Iteration Summary
- **Iter 1**: I'll design the intervention and write an implementation plan as a concrete deliverable.

- **Iter 2**: Now I have excellent context from the milestone specificity audit. Let me create both deliverables.

- **Iter 3**: 

All 4 milestones are already complete as confirmed by the reviewer in iteration 2. Let me verify t

- **Iter 4**: All deployed and verified.

- **Iter 5**: Now create the deployment evidence document:

- **Iter 6**: — All 4 milestones are complete:

1. **Audit existing milestones across 5+ projects** — `.state/mile

