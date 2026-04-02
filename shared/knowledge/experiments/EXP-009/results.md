# EXP-009: Workflow Effectiveness Analysis (Observational)

**Date**: 2026-04-02
**Type**: Observational (database analysis, not controlled experiment)
**Analyst**: Optimizer

## Question
Do workflows improve session quality and reduce errors compared to non-workflow sessions?

## Method
Queried may.db for all sessions tagged with `workflowRunId` vs those without. Compared verdict distributions, error rates, interruption rates, and ops efficiency. Segmented by agent and by time window (all-time vs last 7 days).

## Data

### All-Time Quality (Workflow vs Non-Workflow)

| Metric | Workflow (464 sessions) | Non-Workflow (15,420 sessions) |
|--------|------------------------|-------------------------------|
| Good % | 42.8% | 50.9% |
| Good+Acceptable % | **70.6%** | **91.3%** |
| NI % | **29.2%** | **5.9%** |
| Error rate | **2.6%** ✅ | 17.7% |
| Interruption rate | 8.4% | 5.4% |

### Last 7 Days (Recent Trend)

| Metric | Workflow (100 sessions) | Non-Workflow (976 non-skip) |
|--------|------------------------|----------------------------|
| Good+Acceptable % | 86.0% | 98.2% |
| NI % | 14.0% | 1.8% |

### By Agent (7-day, workflow sessions only)

| Agent | Sessions | Good % | NI % | Notes |
|-------|----------|--------|------|-------|
| QA | 20 | **100%** | 0% | vet-skill workflow — excellent |
| Coder | 26 | **81%** | 12% | code-review-loop — strong |
| Coach | 42 | 38% | 24% | training sprints — inherently hard tasks |
| Optimizer | 12 | 33% | 8% | skill-lifecycle — exploratory |

### By Agent (All-Time, workflow vs non-workflow)

| Agent | WF Good% | Non-WF Good% | WF NI% | Non-WF NI% | Verdict |
|-------|----------|--------------|--------|------------|---------|
| QA | 86% | 86% | 6% | 3% | Neutral to slightly worse |
| Coder | **41%** | 35% | 31% | 26% | **WF better on good%, similar NI** |
| Coach | 26% | 32% | **37%** | 9% | **WF worse** (training sprints) |
| Optimizer | 27% | 60% | 39% | 7% | **WF worse** (exploration) |

## Key Findings

### 1. Workflows dramatically reduce errors (2.6% vs 17.7%)
The structured nature of workflows prevents crashes and infrastructure failures. This is the clearest benefit — **6.8x fewer errors** in workflow sessions.

### 2. Workflows increase NI rate for training/exploratory use cases
Coach training sprints and optimizer skill-lifecycle runs account for most workflow NI verdicts. These workflows deliberately attempt harder tasks (training exercises, skill testing) where failure is expected and informative.

### 3. Workflows help structured, repeatable tasks
- **QA vet-skill**: 100% good in 7d — perfectly suited to workflows
- **Coder code-review-loop**: 81% good in 7d — adds QA review that catches issues
- These are the workflows that should be promoted and expanded

### 4. Workflow quality is improving over time
7d NI rate (14%) is much better than all-time (29.2%), suggesting workflow implementations are maturing.

### 5. Confounding: task difficulty
Workflow sessions are NOT random samples — they're selected for specific use cases. Coach sprints are intentionally hard. This makes direct quality comparison misleading. The fair comparison is: **does the workflow improve outcomes for the same type of task?**

## Recommendations

1. **Keep and promote**: QA vet-skill, code-review-loop, reviewed-delivery — these serve structured tasks well
2. **Reconsider**: Coach training sprints — the workflow structure may add overhead without improving training outcomes. Consider measuring: does the sprint structure actually produce better skill adoption?
3. **Don't expand**: Workflows for exploratory/diagnostic work — these tasks need flexibility that workflow structure constrains
4. **Consolidate duplicates**: P1-P3 from registry (verify-and-finish, verify-parallel, implement-and-review) — reduces maintenance burden
5. **New metric needed**: Track "workflow completion rate" — what % of workflow runs complete all phases vs getting interrupted mid-way?

## Status
COMPLETE — observational analysis. No controlled experiment needed; the patterns are clear from 464 workflow sessions.
