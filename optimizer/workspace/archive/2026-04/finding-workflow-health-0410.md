# Finding: Workflow Health — Post-Adoption Impact Analysis

**Date**: 2026-04-10T20:24  
**Author**: Optimizer (Mode D: Workflow Health)  
**Status**: Complete

## Executive Summary

**Hypothesis rejected.** Workflow sessions do NOT show lower ops or fewer errors than equivalent non-workflow sessions. In fact, D-o-R workflow runs consume **53% more ops** than comparable non-workflow work sessions (45.7 vs 29.9 ops). The error rate improvement is marginal (2.1% vs 3.9%). Quality scores are **incomparable** — workflow and non-workflow sessions use different evaluation scales (0-1 vs 0-5), making quality comparison impossible.

The data reveals workflows are providing **structural value** (forced deliverable verification, phase separation) but not **efficiency value**. They add overhead without reducing total work.

## Data Sources

- **Production DB**: `.state/may.db` — 18,644 sessions, 19,408 evaluations (Mar 4 – Apr 10)
- **Recent window**: Apr 4-10 (2,334 sessions, 105 workflow, 2,229 non-workflow)
- **Workflow filesystem**: `agents/.state/workflows/` — 59 workflow run JSON files (Mar 20-23 period)

## Current Adoption (Apr 4-10)

| Agent | Workflow Sessions | Non-WF Sessions | WF % | Workflow Types |
|-------|:---:|:---:|:---:|---|
| Bob | 96 | 332 | 22.4% | D-o-R (34 runs), parallel-research (9 runs) |
| Coach | 8 | 407 | 1.9% | growth-cycle (4 runs) |
| Coder | 1 | 4 | 20% | 1 verified-coder run |
| Others | 0 | 1,486 | 0% | — |
| **Total** | **105** | **2,229** | **4.5%** | — |

Weekly trend (full dataset):

| Week | Total | Workflow | WF % |
|------|:---:|:---:|:---:|
| W09 (Mar 4-8) | 628 | 104 | 16.6% |
| W10 (Mar 9-15) | 8,351 | 21 | 0.3% |
| W11 (Mar 16-22) | 5,186 | 140 | 2.7% |
| W12 (Mar 20-23) | 1,229 | 187 | 15.2% |
| W13 (Mar 30-Apr 5) | 1,102 | 12 | 1.1% |
| W14 (Apr 6-10) | 2,148 | 105 | 4.9% |

Adoption fluctuates between 0.3% and 16.6% — no clear upward trend.

## Key Comparison: Bob D-o-R vs Non-Workflow Work Sessions

### Ops per Unit of Work

| Metric | D-o-R Runs (n=34) | Non-WF Work Sessions (n=99) | Delta |
|--------|:---:|:---:|:---:|
| **Avg ops/task** | 45.7 | 29.9 | **+53% worse** |
| Median ops | 45 | ~26 | +73% worse |
| Min ops | 5 | 2 | — |
| Max ops | 127 | 111 | +14% |
| Avg duration | ~630s | 341s | +85% worse |

**D-o-R runs use more ops, not fewer.** The Phase 1 "analyze & plan" step alone averages 30.4 ops — already exceeding many complete non-workflow sessions.

### Phase Breakdown (D-o-R)

| Phase | Avg Ops | Sessions | Purpose |
|-------|:---:|:---:|---|
| Phase 1: Analyze & Plan | 30.4 | 36 | Read-only exploration, no writing |
| Phase 2: Write Deliverables | 18.8 | 29 | Write the actual output |
| Phase 3: Verify | 11.0 | 5 | Content verification |

**Phase 1 is the bloat source.** The "DO NOT WRITE DELIVERABLES YET" instruction enables unbounded reading — the agent explores extensively because it has no constraint other than "understand the task." This echoes the earlier finding about the "P1 read-loop" (87 ops in one Phase 1).

### Parallel-Research Phase Breakdown

| Phase | Avg Ops | Sessions |
|-------|:---:|:---:|
| Create plan | 5.8 | 5 |
| Execute step | 19.4 | 7 |
| Evaluate progress | 1.4 | 7 |

Parallel-research runs are leaner (31.4 ops avg/run) because the plan phase is constrained.

### Ops Distribution Comparison

**Non-WF Work Sessions:**
| Bucket | Sessions | % |
|--------|:---:|:---:|
| 0-10 ops | 22 | 22% |
| 11-20 | 19 | 19% |
| 21-30 | 17 | 17% |
| 31-40 | 18 | 18% |
| 41-50 | 8 | 8% |
| 51-60 | 8 | 8% |
| 60+ | 7 | 7% |

**D-o-R Runs (total ops per run):**
| Bucket | Runs | % |
|--------|:---:|:---:|
| 0-10 ops | 2 | 6% |
| 11-20 | 5 | 15% |
| 21-30 | 7 | 21% |
| 31-40 | 2 | 6% |
| 41-50 | 4 | 12% |
| 51-60 | 6 | 18% |
| 60+ | 8 | 24% |

D-o-R has a heavier right tail: 53% of runs exceed 40 ops vs 23% of non-WF sessions.

## Error Rates

| Type | Agent | Sessions | Error+Interrupted | Fail % |
|------|-------|:---:|:---:|:---:|
| Workflow | Bob | 96 | 2 | **2.1%** |
| Workflow | Coach | 8 | 0 | **0%** |
| Non-workflow | Bob | 332 | 13 | 3.9% |
| Non-workflow | Coach | 407 | 31 | 7.6% |

**Workflow sessions have ~50% lower error rates.** This is the clearest positive signal. Structured phases may reduce cascading failures.

## Quality Score Problem: Incomparable Scales

| Type | Evaluation Method | Scale | Avg Score |
|------|---|---|:---:|
| Non-workflow | Heuristic (86%) | 0-5 | 3.98 |
| Workflow | LLM-only (100%) | 0-1 | 0.77 |

**0% of workflow sessions use heuristic evaluation.** 100% use LLM evaluation with a 0-1 scale. Non-workflow sessions are 86% heuristic (0-5 scale). This makes direct quality comparison meaningless.

This is a **data infrastructure bug**: the evaluator should normalize scores to the same scale regardless of method.

## Coach Workflow Health

4 recent growth-cycle runs (Apr 4-10):

| Run | Sessions | Total Ops | Duration |
|-----|:---:|:---:|:---:|
| wr_1775525767506 | 2 | 112 (96+16) | — |
| wr_1775525545867 | 2 | 73 (46+27) | — |
| wr_1775536644819 | 2 | 48 (35+13) | — |
| wr_1775549115709 | 2 | 47 (14+33) | — |

Avg: 70 ops/run vs coach non-WF avg 27.7 ops/session. Same pattern as Bob — workflows add ops overhead. But coach workflows do multi-step work (diagnose → apply fix) that would otherwise require multiple sessions.

## Historical Context (Mar 20-23 DB)

From the older 812-session dataset in `agents/.state/may.db`:

| Agent Group | Runs | Avg Ops/Run | Avg Sessions/Run | Completion % |
|-------------|:---:|:---:|:---:|:---:|
| Optimizer (D-o-R variants) | 11 | 89.6 | 3.9 | 100% |
| Coach (growth-cycle etc.) | 27 | 39.3 | 1.9 | 96% |
| Coder+QA (implement-and-review) | 15 | 26.6 | 3.9 | 93% |

Historical optimizer D-o-R runs averaged **89.6 ops** — even higher than current Bob D-o-R (45.7 ops). Some improvement occurred, likely from the early-exit optimization.

## Implement-and-Review: Still Broken

From filesystem data: 16 runs, 1 done (6.3%), 14 escalated. This workflow remains fundamentally broken due to fragile verdict parsing. Not a health concern since it's not being used in production.

## Conclusions

### What Workflows DO Provide
1. **Lower error rates** — ~50% reduction (2.1% vs 3.9% for Bob)
2. **Structural guarantees** — Phase separation ensures deliverables are attempted
3. **Forced verification** — Phase 3 catches non-delivery (FM-3.1)
4. **100% completion rate** — No workflow runs abandoned mid-stream (recent data)

### What Workflows DON'T Provide
1. **Efficiency** — +53% more ops per task (the opposite of expected)
2. **Comparable quality data** — Different eval scales make comparison impossible
3. **Shorter sessions** — +85% longer duration per task

### Root Cause of Inefficiency
**Phase 1 "analyze & plan" is unbounded.** The instruction "DO NOT WRITE DELIVERABLES YET" creates a perverse incentive to read everything available before writing. Without a write constraint, the agent fills its budget with reading. Average Phase 1: 30.4 ops. Average non-WF complete session: 29.9 ops. Phase 1 alone matches a complete non-workflow session.

## Recommendations

### R1: Cap Phase 1 at 15 ops (HIGH PRIORITY)
Add an explicit constraint: "Phase 1 MUST complete in ≤15 tool calls. Sketch your plan, don't prove it." This would cut D-o-R from 45.7 to ~33 ops avg (28% reduction). Current Phase 2 (18.8 avg) is already reasonable.

### R2: Fix Evaluation Scale Mismatch (MEDIUM)
Normalize all evaluation scores to 0-1 or 0-5. Currently workflow sessions are invisible to quality monitoring because their scores are on a different scale.

### R3: Don't Expand Workflow Adoption Until Efficient (LOW)
The previous finding recommended wiring D-o-R into optimizer and implement-and-verify into tech-lead. Hold these expansions until Phase 1 bloat is fixed. Current workflow overhead would make things worse, not better.

### R4: Track Ops-Per-Run as Primary Workflow Metric
Add `total_ops` aggregation per workflow run to monitoring. Today we only see per-session ops, which hides that a "20-op workflow session" is actually part of a 45-op run.
