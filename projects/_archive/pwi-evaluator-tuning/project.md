# Project: PWI — Evaluator Tuning Experiment

**Status**: done
**Owner**: bob
**Workflow**: master-worker
**Priority**: P1
**Iteration**: 1

**Stop Reason**: All 4 milestones complete
**Resume Condition**: Human/May reviews and marks project done.
## Goal
Reduce project stall rate caused by evaluator rejection loops. The pwi-smart-context experiment showed evaluator scored <7 three times despite reviewer marking DONE — blocking the project for multiple iterations. Hypothesis: evaluator criteria are miscalibrated for "good enough" completion.

## Problem Evidence
- pwi-smart-context: evaluator scored <7 three times on complete work → project marked blocked
- stall-rate baseline: 30% vs 20% target — evaluator rejection loops are a major contributor
- Pattern: evaluator demands rigor level inappropriate for the milestone scope

## Design

**Approach**: Analyze evaluator scoring patterns across all completed projects to identify:
1. What score thresholds cause rejection loops?
2. Are rejections correlated with milestone type (research vs implementation)?
3. What evaluator prompt changes could reduce false rejections without increasing false-done?

**Treatment options** (pick one after analysis):
- A. Raise pass threshold from 7→6 for research milestones
- B. Give evaluator milestone-type context (research vs impl vs measurement)
- C. Add "good enough" scoring rubric focused on deliverable existence, not rigor
- D. Allow 2-attempt max before auto-advancing with caveat

**Measure**: rejection-loop rate (iterations where evaluator rejects ≥2 times on same milestone)

## Milestones
- [x] Audit evaluator scoring: collect scores across 10+ projects, identify rejection loop frequency → See evaluator-audit.md
- [x] Identify root cause: is it threshold, rubric, or context? → Rubric (demands publication rigor for milestone completion) + no loop-breaking mechanism
- [x] Design intervention (pick from treatment options A-D) → Hybrid C+D: good-enough rubric + 2-attempt cap → See intervention-design.md
- [x] Implement and test on 2+ projects

## Current State
done: All 4 milestones complete

## Resources
- Workflow code: agents/shared/workflows/project.ts
- Parent tracker: agents/bob/workspace/projects/project-workflow-improvement/project.md
- Evidence: pwi-smart-context evaluator rejection logs

## Comments


## Iteration Summary
- **Iter 5**: Now I have the full picture. Let me write the verification report.

