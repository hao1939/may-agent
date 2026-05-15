# Finding: D-o-R Budget Cap Impact — Phase 1 Fix Delivers 71% Reduction

**Date**: 2026-04-12T18:24 UTC  
**Author**: Optimizer (Mode D: Workflow Health)  
**Status**: Complete

## Executive Summary

The Phase 1 budget cap fix (commit 40b22057, deployed ~Apr 11) has **dramatically reduced D-o-R Phase 1 costs**. Bob's P1 avg dropped from **31.9 ops → 9.4 ops (71% reduction)**. Excluding 4 cap-violation sessions (9.5% of runs), compliant P1 sessions average just **3.6 ops (89% reduction)**. Full D-o-R run cost dropped from **45.4 → 25.8 ops (43% reduction)**. Workflow adoption surged to **27.1%** on Apr 12, up from 8.5% (Apr 10).

## Q1: D-o-R Phase 1 Cost — Pre-Fix vs Post-Fix

### Phase 1 Session Ops

| Metric | Pre-Fix (n=37) | Post-Fix (n=42) | Change |
|--------|:-:|:-:|:-:|
| **Avg ops** | 31.9 | 9.4 | **-71%** |
| **Median** | 30 | 3 | **-90%** |
| Compliant avg (≤15 ops) | — | 3.6 | **-89% vs pre-fix avg** |
| Violation rate (>15 ops) | 57% (21/37) | 9.5% (4/42) | **-83%** |

### Full D-o-R Run Cost (total ops per workflowRunId)

| Metric | Pre-Fix (n=18) | Post-Fix (n=42) | Change |
|--------|:-:|:-:|:-:|
| **Avg total ops/run** | 45.4 | 25.8 | **-43%** |
| **Median** | 32 | 20 | **-38%** |
| **P90** | 101 | 60 | **-41%** |

### Verdict: The +53% overhead is shrinking

The original finding showed D-o-R used +53% more ops than non-WF work sessions (45.4 vs 29.9). Post-fix D-o-R averages 25.8 ops/run. Bob's non-WF sessions (Apr 11-12) average 13.5 ops. The overhead is now **+91% relative** but in absolute terms the gap narrowed from +15.5 ops to +12.3 ops. The high relative percentage reflects that Bob's non-WF sessions also got more efficient (down from 29.9 to 13.5), so D-o-R's structural overhead now stands out more.

## Q2: Workflow Adoption Rates

| Day | Workflow Sessions | Total | Rate | Trend |
|-----|:-:|:-:|:-:|:-:|
| Apr 10 | 45 | 528 | **8.5%** | Baseline |
| Apr 11 | 87 | 581 | **15.0%** | +77% (optimizer joins) |
| Apr 12 | 156 | 575 | **27.1%** | +81% (optimizer at 66.1%) |

### By Agent (Apr 12)

| Agent | WF Sessions | Total | Rate |
|-------|:-:|:-:|:-:|
| Bob | 80 | 118 | **67.8%** |
| Optimizer | 72 | 109 | **66.1%** |
| Coder | 4 | 8 | 50.0% |
| Others (7 agents) | 0 | 340 | 0% |

**Key shift**: Optimizer went from 0% (Apr 10) → 27.5% (Apr 11) → 66.1% (Apr 12) via verify-wrap workflow. Bob steady at 44-68%. Together they drive system-wide adoption to 27.1%.

## Q3: Anti-Patterns & Violations

### P1 Budget Cap Violations (4/42 = 9.5%)

| When | Ops | Task | Root Cause |
|------|:-:|------|------|
| Apr 12 04:54 | 90 | KB INDEX.md backlog integration | Bulk INDEX file editing — 90 entries |
| Apr 12 02:24 | 93 | KB INDEX batch integration | Same pattern — batch INDEX work |
| Apr 11 23:24 | 37 | Analyze EXP-143 results | Deep analysis crossing P1 boundary |
| Apr 11 15:24 | 40 | Bayesian Scorecard Update | Complex multi-hypothesis update |

**Pattern**: All 4 violations involve tasks that are inherently write-heavy but were routed through D-o-R anyway. The 90 and 93-op violations are **KB INDEX batch updates** — these shouldn't use D-o-R at all (they're bulk mechanical writes, not analyze-then-write tasks).

**Anti-pattern**: D-o-R is being applied to mechanical/batch tasks where Phase 1 "analysis" becomes the entire delivery.

### Parallel-Research Cost Spikes

Bob's parallel-research workflow averages **67.2 ops/run** (n=17), with extreme outliers:
- 227 ops (Apr 11 22:26) — 4 sessions, 79+79+51+18 ops
- 166 ops (Apr 12 01:24) — 3 sessions, 15+38+113 ops  
- 106 ops (Apr 12 10:54) — 3 sessions, 77+20+9

The 113-op synthesis session is a new anti-pattern: the "Research Synthesis" step consuming as many ops as the research threads combined.

### Optimizer verify-wrap Overhead

Optimizer's verify-wrap adds near-zero overhead:
- 48/50 verification sessions cost **0 ops** (96%)
- Average verify-wrap run: 32.2 ops (driven by work session, not verification)
- Only 2 verification sessions had ops (3 and 7) — likely re-reading for proper verification

## Q4: Bob P1 Op Count vs Pre-Cap Baseline

| Period | Bob P1 Avg Ops | Bob D-o-R Run Avg | Non-WF Avg |
|--------|:-:|:-:|:-:|
| Pre-cap (Apr 4-10) | 31.9 | 45.4 | 29.9 |
| Post-cap (Apr 11-12) | **9.4** | **25.8** | **13.5** |
| Post-cap compliant only | **3.6** | — | — |

The 15-op cap is working: **90.5% compliance rate**, with compliant sessions averaging just 3.6 ops. The remaining 9.5% violations are routing mismatches (batch tasks going through D-o-R).

## Cost Savings Estimate

### Phase 1 Savings
- Pre-fix: ~24 D-o-R runs/day × 31.9 avg P1 ops = **766 P1 ops/day**
- Post-fix: ~24 D-o-R runs/day × 9.4 avg P1 ops = **226 P1 ops/day**
- **Savings: ~540 ops/day (~$26/day)**

### But: Parallel-Research is the New Cost Center
- 17 parallel-research runs in ~36h ≈ **11 runs/day**
- Avg 67.2 ops/run = **740 ops/day** — similar to what D-o-R P1 was costing
- This partially offsets D-o-R savings

## Error Rates

| Type | Apr 12 | Rate |
|------|:-:|:-:|
| Workflow | 3/156 | **1.9%** |
| Non-workflow | 13/419 | **3.1%** |

Workflow error rate remains ~40% lower than non-WF, consistent with previous finding.

## Recommendations

### R1: Route Batch/Mechanical Tasks Away from D-o-R (HIGH)
The 90 and 93-op P1 violations are KB INDEX batch updates. These should bypass D-o-R entirely — they don't need an analyze-then-plan phase. Task routing should detect bulk integration tasks and use a simpler write-only workflow.

### R2: Cap parallel-research Synthesis Phase (MEDIUM)
The synthesis step is the new bloat vector (113 ops in one session). Add a 15-op budget cap similar to D-o-R Phase 1. Current avg for synthesis is 12.3 ops — already reasonable for most runs, but outliers drag the average up.

### R3: Monitor P1 Compliance Programmatically (LOW)
Current 9.5% violation rate is acceptable but should be tracked. Could add a post-session check that flags P1 sessions exceeding 15 ops, triggering a review of whether the task was misrouted.

## Data Sources

- `.state/may.db` — 18,684+ sessions (Mar 4 – Apr 12)
- Pre-fix: 37 Bob P1 sessions (Apr 9-10), post-fix: 42 Bob P1 sessions (Apr 11-12)
- 128 workflow runs spanning Apr 10-12 analyzed
- Baseline from `finding-workflow-health-0410.md` (45.7 avg D-o-R ops, 29.9 non-WF)
