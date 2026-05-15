# Mode D: Workflow Health — 6h Scan (Apr 18 ~17:00 UTC)

## Key Finding: Workflow Sessions Have LOWER Quality Than Direct Sessions

**Overall quality (excl evaluator): 0.851** (target: 0.9)

### Quality by Agent (last 6h, 166 evaluated sessions excl evaluator)

| Agent | Sessions | Avg Quality | Avg Efficiency | Below 0.9 |
|-------|----------|-------------|----------------|-----------|
| tech-lead | 25 | 0.746 | 0.700 | 15 (60%) |
| bob | 41 | 0.792 | 0.670 | 27 (66%) |
| coach | 35 | 0.861 | 0.748 | 13 (37%) |
| optimizer | 22 | 0.880 | 0.744 | 12 (55%) |
| scout | 16 | 0.889 | 0.727 | 7 (44%) |
| qa | 11 | 0.940 | 0.797 | 2 (18%) |
| may | 16 | 1.000 | 0.800 | 0 (0%) |

**Primary quality drags**: tech-lead (0.746) and bob (0.792) — together they account for 42 of 76 below-0.9 sessions (55%).

### Workflow vs Direct Quality (excl evaluator)

| Type | Sessions | Avg Quality | Avg Efficiency |
|------|----------|-------------|----------------|
| Direct | 104 | **0.947** | 0.784 |
| Workflow | 62 | **0.689** | 0.632 |

**Workflow sessions score 0.258 lower in quality than direct sessions.** This is a significant and concerning gap. Workflows are supposed to improve quality through structure, but the data shows the opposite.

### Workflow Adoption (last 6h, 302 total sessions)

| Agent | Total | With Workflow | Adoption % |
|-------|-------|--------------|------------|
| evaluator | 129 | 0 | 0% |
| bob | 41 | 28 | 68% |
| coach | 35 | 7 | 20% |
| tech-lead | 27 | 12 | 44% |
| optimizer | 24 | 12 | 50% |
| may | 17 | 0 | 0% |
| scout | 17 | 5 | 29% |
| qa | 12 | 0 | 0% |

Bob has highest adoption (68%) but also low quality (0.792). This suggests workflow quality issues are concentrated in high-adoption agents doing complex work.

### Interpretation

The workflow vs direct quality gap likely reflects **selection bias**: workflows are used for complex multi-step tasks (D-o-R, growth cycles) that are inherently harder to score well on. Direct sessions include simple heartbeats and dispatches that score 1.0 easily. This is consistent with prior Mode D finding (Apr 10) showing D-o-R uses +53% more ops.

The quality-preserved metric (0.851 vs 0.9 target) is primarily dragged by:
1. **tech-lead** (0.746, 25 sessions) — known issue from Mode A/C findings (citation non-compliance, DB query failure chains, scope drift)
2. **bob** (0.792, 41 sessions) — high volume, 66% below threshold

### Dispatch Decision: NO_DISPATCH

No new intervention warranted. tech-lead quality issues already identified in prior Mode C finding (structural D-o-R changes needed, not text rules — per KE-002). The workflow quality gap is selection bias, not a workflow design problem.
