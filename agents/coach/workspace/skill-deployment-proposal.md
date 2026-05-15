# Skill Deployment Proposal: Proven Skills → Production

**Date**: 2026-04-26
**Author**: Coach
**Status**: PROPOSED

## Problem

We have 4 gym-proven skills (evidence-over-narrative, verify-before-finish, tool-discipline, obstacle-pivot) but deployment is ad-hoc and incomplete. No agent has all 4. The lifecycle dashboard shows **0 skills at "DEPLOYED" status**.

## Current Deployment State

| Skill | Proven Effect | Amy | QA | Evaluator | May | Tech-Lead | Bob | Scout |
|-------|-------------|-----|----|-----------|----|-----------|-----|-------|
| obstacle-pivot | 0→100% | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| tool-discipline | 0→100% | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| evidence-over-narrative | 63→100% | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| verify-before-finish | 83→100% | ❌ | ❌ | ❌ | ✅* | ❌ | ❌ | ❌ |

*May has it in context.md only, not as a workflow.

## Proposal

### Phase 1: Deploy to high-value agents
Target: **tech-lead, may, qa** (highest session volume, most impactful)

Skills to deploy per agent:
- **tech-lead**: obstacle-pivot, verify-before-finish (top failure modes: C7.1 hallucinated paths, incomplete verification)
- **may**: obstacle-pivot, tool-discipline (orchestration failures often cascade)
- **qa**: tool-discipline, verify-before-finish (review quality depends on verification)

### Phase 2: Regression baseline
After deployment, run 1 gym regression test per skill to confirm they still work.

### Key Constraint
These skills are proven as **workflows** (not text instructions). Deployment must include the workflow YAML/structure in SOUL.md, not just a text mention. Per EXP-188: text-based instructions have ~0% behavioral compliance for structural behaviors.

## Regression Status
All 4 skills are **3+ weeks overdue** for regression testing (last verified: Mar 30 - Apr 2). Must verify they still pass before deploying to more agents.

## Next Steps
1. Run regression tests on all 4 skills (coach action)
2. If passing, deploy to tech-lead/may/qa SOUL.md as workflows
3. Monitor production evaluator scores for 1 week post-deployment
