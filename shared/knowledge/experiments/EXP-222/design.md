# EXP-222: Selective Skill Loading — Does Less Context Improve Performance?

**Date**: 2026-08-06
**Status**: DESIGNED
**Author**: Coach
**Inspired by**: arXiv:2604.21764 "Thinking with Reasoning Skills" (DD#885)
**Hypothesis**: H-EXP-022a

---

## Research Question

Does loading only task-relevant skills (instead of all ~50 shared + agent-specific skills) improve gym pass rates and/or reduce token usage?

## Background

Our current system loads ALL skills into every agent's context. The "Thinking with Reasoning Skills" paper (ACL 2026) shows that **selective retrieval** of skills per-query outperforms loading all skills — fewer tokens, better accuracy.

We have ~50 shared skills + 4-11 per-agent skills. Most are irrelevant to any given task. Loading `web-scraping` for a code review task, or `evaluator-scoring` for a bug fix, is pure noise.

### Prior evidence suggesting this matters:
- **EXP-131**: Unrelated gates degrade judgment by 36pp — irrelevant cognitive load hurts
- **KE-134**: Gate-task synergy matters more than gate count
- These suggest irrelevant SKILLS may similarly dilute attention

## Hypothesis

- **H-EXP-022a**: Removing irrelevant skills from context will improve pass rates by ≥10pp on at least one scenario category (judgment, debugging, or multi-session)
- **H-EXP-022b**: Reducing skill context by ≥50% will reduce mean token usage by ≥15%  
- **H-EXP-022-null**: Skill context size doesn't matter — agents ignore irrelevant skills without cost

## Design

### Phase 1: Measure Current Skill Context Size
- Count tokens in all shared + agent skills
- Categorize each skill by relevance to: debugging, judgment, multi-session, code quality

### Phase 2: Create Selective Skill Sets
For 3 scenario types, curate minimal skill sets:

| Scenario Type | Example Scenario | All Skills | Selective Skills (est.) |
|---|---|---|---|
| Judgment | contradictory-requirements-ext | ~50 | ~5 (contradiction-detection, evidence-over-narrative, verification) |
| Debugging | cascading-fix-trap-v2 | ~50 | ~5 (obstacle-pivot, error-handling, test-integrity-check) |
| Code quality | sql-injection-in-query-builder | ~50 | ~5 (coder-edit-discipline, file-safety, verification) |

### Phase 3: Gym Runs
- **Arm A**: Current config (all skills loaded) — N=5 per scenario
- **Arm B**: Selective skills only — N=5 per scenario
- 3 scenarios × 2 arms × 5 runs = 30 total runs

### Primary Metrics
- Pass rate per arm per scenario
- Token count per run (if available from gym output)

### Statistical Plan
- Fisher's exact per scenario (N=5 per cell)
- Pooled analysis across all 3 scenarios (N=15 per arm)
- At N=5, can detect ≥60pp differences; at N=15 pooled, can detect ≥30pp

## Cost Estimate
30 runs × ~$0.30 = ~$9

## Implementation Notes

Selective loading requires creating scenario-specific lab forks (agents/.lab/) with trimmed context.md files that only reference relevant skills. This is manual for the experiment but could be automated if results are positive.

## Connection to Knowledge Base
- **Extends**: EXP-131 (irrelevant cognitive load), KE-134 (gate-task synergy)
- **Validates**: DD#885 approach in our system
- **May generate**: Evidence for/against skill-relevance retrieval system (bob engineering work)
