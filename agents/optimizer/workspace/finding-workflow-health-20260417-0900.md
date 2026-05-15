# Finding: Workflow Health 12h Check — persistent-task is the new cost center

**Date**: 2026-04-17T09:00 UTC
**Author**: Optimizer (Mode D: Workflow Health)
**Window**: Last 12h, with 24–48h comparisons

## Executive Summary

All prior workflow fixes (D-o-R P1 cap, parallel-research synthesis cap, verify-wrap JS verification) are **holding** in the last 12h. But a **new regression is visible**: the `persistent-task` workflow has **no per-iteration budget cap**, and its worker prompt now produces **iter-1 spikes up to 59 ops** (avg 20.1 ops across 34 iter-1 sessions / 48h). Over 48h, persistent-task consumed **884 ops (~442/day)** — comparable to what D-o-R P1 cost pre-fix. A soft budget cap (same pattern that fixed D-o-R P1) should recover ~25–40% of that.

## 12h System Adoption (by agent)

| Agent | Total | WF | Adoption | Avg Ops |
|-------|------:|---:|---------:|--------:|
| evaluator | 116 | 0 | 0% | 0.0 |
| coach | 51 | 7 | 13.7% | 15.5 |
| tech-lead | 47 | 21 | 44.7% | 6.5 |
| optimizer | 46 | 24 | 52.2% | 7.7 |
| scout | 25 | 1 | 4.0% | 2.2 |
| may | 25 | 0 | 0% | 3.2 |
| qa | 24 | 1 | 4.2% | 7.9 |
| bob | 24 | 0 | 0% | 1.3 |

**Adoption stable** relative to Apr 17 baseline (finding-workflow-health-0417.md): optimizer 52.2% vs 48.2% (24h), tech-lead 44.7% vs 43.4%. Excluding evaluator: 54/354 = **15.3%** (slightly lower than 24h 29.6% — driven by Bob having no workflow work in the last 12h).

## Fix Verification: Prior Fixes Are Holding

### D-o-R Phase 1 Budget Cap (deployed Apr 11, commit 40b22057)
- **Bob P1 ops last 24h**: n=1, ops=1 — no P1 violations.
- Bob has no active D-o-R runs in the last 12h (only heartbeats).
- **Status: HOLDING**. No regression detected.

### Parallel-Research Synthesis Cap
- Last 48h: **10 parallel-research runs, total 60 ops, avg 6.0 ops/run**.
- Last 24h: 4 runs, 10 ops, avg 2.5.
- Synthesis sessions (bob): 6 data points in 48h, all ≤15 ops (4, 6, 7, 7, 7, 11, 15).
- Compare to Apr 12 baseline: 67.2 ops/run with 113-op synthesis outliers.
- **Status: HOLDING**. Dramatic improvement vs Apr 12 spike.

### verify-wrap (LLM→JS)
- Optimizer workflow runs: 24 runs, 278 ops, 11.6 avg. Still well-behaved.
- **Status: HOLDING**.

## 🔴 New Regression: persistent-task Workflow Has No Budget Cap

### Volume / Cost (48h)

| Scope | n | Total ops | Avg | Max |
|-------|--:|---------:|----:|----:|
| All persistent-task iterations | 45 | 884 | 19.6 | 59 |
| Iter 1 (cold start) | 34 | 684 | **20.1** | 59 |
| Iter 2+ (warm) | 11 | 200 | 18.2 | 40 |
| **High-op (≥25 ops)** | 13 | 511 | 39.3 | 59 |

### By Agent (48h)

| Agent | n | Avg ops | Max |
|-------|--:|--------:|----:|
| bob | 15 | 24.1 | 59 |
| coder | 12 | 19.4 | 43 |
| tech-lead | 14 | 16.4 | 43 |
| optimizer | 4 | 15.3 | 25 |

### Root Cause

`agents/shared/workflows/persistent-task.ts:218-244` — `buildWorkerPrompt()` — contains **no explicit op budget**. Contrast with D-o-R Phase 1 prompt (capped at 15 ops post-fix) and parallel-research synthesis (capped at 15 ops). The persistent-task worker prompt says:

> "Do a meaningful chunk of work toward the goal. When done, summarize what you accomplished…"

No ceiling. Agents interpret "meaningful chunk" as unbounded. Iter-1 cold-start cost is 20 ops avg, with 59-op outliers where bob runs 8+ gym trials inline.

### Two Distinct Cost Shapes in the Data

1. **Implementation-iter1 bloat** (coder 43, tech-lead 43): full analysis + implementation in single iteration. This is where a budget cap would help most — these should split across iter-1 (analyze) and iter-2 (implement).
2. **Legitimate batch work** (bob EXP-166/167 gym trials at 30–59 ops): iter runs 5–8 gym trials (~3 ops each) plus bookkeeping. A rigid cap would break this.

### Cost Estimate

Current: ~442 ops/day via persistent-task.
If we move iter-1 implementation cases from avg 20 → 12 (40% reduction, same 86% compliance achieved by D-o-R cap), projected savings: **~150 ops/day (~$7/day)**. Modest but clean.

## Anti-Patterns Not Observed (Good News)

- No parallel-research synthesis spikes (<20 ops all of 48h).
- No D-o-R P1 violations (n=1 in 24h, 1 op).
- Workflow error rate: 0 failures in 12h across 54 workflow sessions. Only 2 `running` (still in-flight).

## Recommendations

### R1 (HIGHEST — do now): Add soft op-budget guidance to persistent-task worker prompt
- **File**: `agents/shared/workflows/persistent-task.ts`
- **Location**: `buildWorkerPrompt()` at lines 218–244, in the `## Instructions` section (~line 230).
- **Change**: Append a "Budget" line to the instructions:
  > `\n### Budget\nMost iterations should fit in ≤20 tool calls. If your plan needs more, split work across iterations (end this iteration at a clean checkpoint, record progress to the project file, and let the loop pick up next iteration). Exception: iterations that run gym trials or other bulk external commands — those are allowed to exceed the budget.\n`
- **Expected impact**: ~25–40% reduction on implementation-type iter-1 sessions (coder 43, tech-lead 43, optimizer 25 class), preserving bulk-gym iters. Projected savings ~100–150 ops/day.
- **Safety**: Soft guidance with explicit exception. Mirrors D-o-R P1 cap pattern which achieved 90.5% compliance with zero quality regression.
- **Doable by optimizer right now** — single-file, one-section edit in shared repo.

### R2 (MEDIUM): Differentiate iter-1 prompt (cold-start) vs iter-N prompt
- **File**: same, `buildWorkerPrompt()`
- **Change**: When `iteration === 1`, add an explicit "Plan-only scope" hint: start with understanding + minimal setup; save implementation for iter 2. This attacks the coder/tech-lead iter-1 43-op cases specifically.
- **Expected impact**: Further ~50 ops/day on top of R1.
- **Why not R1**: Higher risk of over-constraining legitimate iter-1-does-it-all tasks (short goals). Ship after R1 proves out.

### R3 (LOW): Monitor persistent-task iter-1 distribution
- **File**: optimizer's workspace (observational)
- **Change**: Track iter-1 avg weekly. If R1 lands, expect iter-1 avg 20 → 12 within 48h of deploy.
- **No code change**.

## Data Sources

- `.state/may.db`, last 48h
- `agents/shared/workflows/persistent-task.ts` (source read, 614 lines)
- Baselines: `finding-workflow-health-0417.md`, `finding-dor-budget-cap-impact-0412.md`

## Status

**DISPATCH-READY is not needed** — R1 is doable by optimizer directly (the persistent-task workflow file is in `agents/shared/`, the optimizer's writable scope). Phase 2 should execute R1 as a direct edit-and-verify.
