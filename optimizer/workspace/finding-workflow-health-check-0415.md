# Finding: Workflow Health Check — Apr 15, 2026 (PM)

**Date**: 2026-04-15 09:32 UTC  
**Mode**: D (Workflow Health)  
**Analyst**: optimizer  
**Measurement**: `workflowRunId IS NOT NULL` (accurate metric, per Apr 15 AM correction)

## Executive Summary

System-wide workflow adoption is **11.2% (48h)**, fluctuating between 4.6-22.8% daily with no sustained upward trend. Workflow sessions use **more ops** than direct sessions (21.4 vs 11.1), confirming the Apr 10 finding that workflows provide structural value but not efficiency value. The Apr 12 peak (22.8%) was not sustained — adoption dropped to 4.6% on Apr 14 before rebounding to 19.6% today.

## Key Metrics (Last 48h)

| Metric | Value |
|--------|-------|
| Total sessions | 1,123 |
| Workflow sessions | 126 (11.2%) |
| Avg ops (workflow) | 21.4 |
| Avg ops (direct) | 11.1 |
| Workflow completion rate | 92.9% done (117/126) |
| Direct completion rate | 89.1% done (888/997) |
| Workflow interrupts | 4.8% (6/126, avg 51.8 ops) |
| Direct interrupts | 10.2% (102/997, avg 19.2 ops) |
| Workflow errors | 0 |
| Direct errors | 2 (auth token expiry) |

## 7-Day Daily Trend

| Date | Total | Workflow | Rate | Δ |
|------|-------|----------|------|---|
| Apr 09 | 459 | 30 | 6.5% | — |
| Apr 10 | 526 | 51 | 9.7% | ↑ |
| Apr 11 | 525 | 43 | 8.2% | ↓ |
| **Apr 12** | **679** | **155** | **22.8%** | **↑ Peak** |
| Apr 13 | 413 | 94 | 22.8% | → |
| Apr 14 | 628 | 29 | 4.6% | ↓↓ Drop |
| Apr 15 | 495 | 97 | 19.6% | ↑↑ Recovery |

**Pattern**: No monotonic growth. Adoption oscillates — suggesting workflow use is event-driven (specific task types) rather than habitual.

## Per-Agent Adoption (48h)

| Agent | Total | WF Sessions | Rate | Avg WF Ops | Avg Direct Ops | Ops Delta |
|-------|-------|-------------|------|------------|----------------|-----------|
| **Coder** | 29 | 23 | **79.3%** | 14.3 | 30.5 | **-53%** ✅ |
| **Bob** | 149 | 39 | 26.2% | 27.2 | 13.4 | +103% ⚠️ |
| **Optimizer** | 152 | 32 | 21.1% | 22.4 | 12.3 | +82% ⚠️ |
| **Coach** | 163 | 20 | 12.3% | 21.5 | 14.5 | +48% ⚠️ |
| **Tech-lead** | 161 | 7 | 4.3% | 11.3 | 16.6 | -32% ✅ |
| **Scout** | 90 | 3 | 3.3% | 24.0 | 10.8 | +122% ⚠️ |
| **QA** | 78 | 2 | 2.6% | 7.0 | 7.4 | -5% → |
| **Evaluator** | 210 | 0 | 0% | — | 2.1 | — |
| **May** | 91 | 0 | 0% | — | 15.0 | — |

### Notable Findings

1. **Coder is the only agent where workflows reduce ops** (-53%). This aligns with KE-015: coder tasks have high decision topology R (structured coding tasks with clear deliverables), making workflows beneficial.

2. **Bob and Optimizer show significant ops inflation** (+103% and +82%) from workflows. Their direct sessions average 12-13 ops; workflow sessions balloon to 22-27 ops. This matches the Apr 10 finding of D-o-R +53% overhead.

3. **Tech-lead workflows are rare (4.3%) but efficient** (-32% ops). Small sample (n=7) though.

## Completion Quality

| Type | Done | Interrupted | Error | Int. Avg Ops |
|------|------|-------------|-------|-------------|
| Workflow | 92.9% | 4.8% | 0% | 51.8 |
| Direct | 89.1% | 10.2% | 0.2% | 19.2 |

Workflows have **higher completion rate** (92.9% vs 89.1%) and **lower interrupt rate** (4.8% vs 10.2%). However, when workflows ARE interrupted, they're deep in (51.8 avg ops vs 19.2 for direct) — suggesting the interrupts are budget-related rather than error-related.

## Comparison to Previous Measurements

| Metric | Apr 10 | Apr 12 | Apr 15 (now) | Trend |
|--------|--------|--------|--------------|-------|
| Adoption rate | 4.5% | 22.8% | 11.2% | Oscillating |
| WF ops overhead | +53% | — | +93% | Worsening |
| WF completion | — | — | 92.9% | Good |
| WF interrupt rate | — | — | 4.8% | Low |

## Conclusions

1. **Adoption is NOT growing monotonically** — it oscillates between 5-23% based on task mix, not habit formation. No intervention has created sustained adoption.

2. **Workflows cost more ops for most agents** — only Coder shows efficiency gains. For Bob/Optimizer/Coach/Scout, workflows add 48-122% ops overhead.

3. **Workflows DO improve completion quality** — 93% completion vs 89% for direct, with lower interrupt rates. The structural value (forced verification, phase separation) is real even if efficiency is worse.

4. **Coder is the workflow success story** — 79% adoption, -53% ops. High decision topology R tasks (coding) benefit most from workflow structure (confirming KE-015).

## Recommendations

- **Don't push universal workflow adoption** — the data shows they only help specific task types (high-R, structured deliverables)
- **Investigate Bob/Optimizer ops inflation** — why do their workflow sessions use 2x the ops? Is the workflow overhead worth the structural benefit?
- **Coder model is working** — maintain current approach, consider whether similar high-R tasks for other agents could benefit
