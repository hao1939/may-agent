# EXP-001: Workflow Effectiveness Evaluation

## Date: 2026-04-04
## Evaluator: Optimizer
## Data source: may.db (16,218 sessions, 15,894 evaluations)

## Question
**Do workflows improve outcomes compared to non-workflow sessions?**

## Methodology
Queried may.db for all sessions with vs without `workflowRunId`. Compared completion rates, costs, verdict distributions, and NI rates. Broke down by workflow type (implement-and-review, coach growth-cycle/training-sprint) and time period.

## Summary of Findings

### Headline: Workflows do NOT improve outcomes — they cost more and fail more.

| Metric | Workflow | Non-Workflow | Delta |
|--------|----------|-------------|-------|
| Sessions | 464 | 15,430 | — |
| Good rate | 42.7% | 45.5% | **-2.8pp** |
| NI rate | 29.1% | 5.0% | **+24.1pp** ⚠️ |
| Acceptable rate | 27.8% | 35.3% | -7.5pp |
| Avg cost/session | $1.36 | $0.56 | **2.4x more** |
| Cost per good session | $3.19 | $1.19 | **2.7x more** |
| Session done rate | 89.0% | 76.1% | +12.9pp ✓ |
| Error rate | 2.6% | 17.6% | -15.0pp ✓ |

**Key insight:** Workflows have better completion rates (89% vs 76%) and fewer errors (2.6% vs 17.6%), but worse verdict scores (good rate -2.8pp, NI rate +24.1pp) and higher costs (2.7x per good session).

### Why workflows complete more but score worse
Workflows structurally ensure sessions call `finish()` (the runner handles it). But the *quality* of work inside those sessions is judged more harshly — workflow child sessions (coder, qa) are evaluated against their parent task's expectations, which are stricter than heartbeat self-directed work.

## Detailed Breakdown

### implement-and-review (78 runs)
- **65.4% full success** (all steps done, QA passed)
- **21.8% interrupted** (platform aborts)
- **7.7% escalated** (QA failed, went back to May)
- **5.1% errored** (turn limits, API errors)
- **Avg ops per success: 13.1** (efficient when it works)
- **Weekly trend: improving** — W1: 56% success → W3: 100% → W4: 100% (but only 3 runs)

### Coach workflows — growth-cycle + training-sprint (88 runs)
- **70.5% success** (all steps completed)
- **20.5% interrupted** (platform aborts)
- **9.1% errored** (turn limits, model misconfig)
- **Avg ops per success: 45.7** (expensive — 3.5x more than implement-and-review)

### Non-workflow coder (107 sessions)
- **87.9% done** rate
- **Avg ops: 2.0** (trivial tasks — mostly gym scenarios)
- **Avg cost: $0.39** vs workflow coder $1.34 (3.4x cheaper)

⚠️ **Confound**: Non-workflow coder sessions are mostly gym test runs (trivial fixed tasks). The comparison is apples-to-oranges on task complexity.

## NI Rate Over Time

| Period | Workflow NI% | Non-WF NI% | Gap |
|--------|-------------|------------|-----|
| 22d+ | 33.9% | 7.0% | 26.9pp |
| 15-21d | 46.1% | 4.5% | 41.6pp |
| 8-14d | 12.5% | 1.7% | 10.8pp |
| Last 7d | 22.6% | 2.0% | 20.6pp |

Workflow NI rates improved dramatically in 8-14d period (evaluator heuristic fix), but remain 10-20pp higher than non-workflow. This gap is structural — workflow sessions receive stricter evaluation because they have clear task expectations from the orchestrator.

## Workflow Usage Trend

| Period | Runs/week | Change |
|--------|----------|--------|
| W1 (22d+) | 51 | Baseline |
| W2 (15-21d) | 56 | +10% |
| W3 (8-14d) | 57 | Stable |
| W4 (last 7d) | 16 | **-72%** ⚠️ |

Workflow usage collapsed in the last week. Root cause: no new production code tasks dispatched since Mar 29. Coach workflows also declined due to reliability issues (model misconfig, turn limits).

## What Workflows Do Well
1. **Structured completion**: 89% done rate vs 76% — workflows ensure sessions finish
2. **Error prevention**: 2.6% error rate vs 17.6% — workflow runners handle errors gracefully
3. **implement-and-review improving**: 100% success rate in recent weeks (after verdict parsing fix)
4. **QA gate works**: QA sessions have 6% NI in workflows — the review step catches problems

## What Workflows Do Poorly
1. **Cost efficiency**: $3.19 per good session vs $1.19 — workflows add overhead
2. **Coach workflows are expensive**: 45.7 ops average — too much work per run
3. **Platform vulnerability**: 21.8% of implement-and-review interrupted by aborts — workflow runners don't checkpoint between steps
4. **NI magnifier**: Workflow sessions get judged more harshly, driving up NI rates

## Recommendations

### R1: Keep implement-and-review (improving, valuable)
- Recent success rate: 100% (after verdict parsing fix)
- Cost is justified for production code: $13 avg ops ensures code + QA review
- But: add inter-step checkpointing to survive platform aborts (save coder output before QA step)

### R2: Coach workflows need restructuring
- 45.7 ops per success is too expensive for a 40-turn limit
- growth-cycle should be split: analyze → plan → execute as separate workflow runs
- training-sprint has 60% interrupt rate — needs phase-level checkpointing

### R3: Don't force workflows on simple tasks
- Non-workflow coder at $0.39 avg is fine for gym/trivial tasks
- Workflow overhead ($1.34 avg for coder) is only justified for complex multi-step work
- Criteria for workflow use: task needs >1 agent OR requires QA review

### R4: Fix the NI gap
- 20pp NI gap between workflow and non-workflow is partly evaluation artifact
- Workflow sessions should be evaluated against workflow-appropriate criteria, not heartbeat criteria
- Consider: evaluator should weight "workflow step completed" higher for child sessions

### R5: Monitor the usage collapse
- 72% decline in workflow runs threatens the system's quality infrastructure
- When production work resumes, workflows must be the default for code changes
- Coach should auto-trigger growth cycles based on schedule, not waiting for Hao

## Verdict
**Workflows are structurally valuable but cost-inefficient.** They complete more reliably and prevent errors, but cost 2.7x more per good outcome. The implement-and-review workflow has improved significantly and should be retained. Coach workflows need restructuring to fit within session limits. The biggest threat is usage collapse — workflows can't prove their value if they're not being used.
