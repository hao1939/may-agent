# Project: PWI — Evaluator Tuning Experiment

**Status**: active
**Owner**: bob
**Priority**: P1
**Iteration**: 0
**Health**: 7/10

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
- [ ] Audit evaluator scoring: collect scores across 10+ projects, identify rejection loop frequency
- [ ] Identify root cause: is it threshold, rubric, or context?
- [ ] Design intervention (pick from treatment options A-D)
- [ ] Implement and test on 2+ projects

## Current State
New project. Need to audit evaluator scoring patterns first.

## Resources
- Workflow code: agents/shared/workflows/project.ts
- Parent tracker: agents/bob/workspace/projects/project-workflow-improvement/project.md
- Evidence: pwi-smart-context evaluator rejection logs
