# Finding: Workflow Health — Post-Fix D-o-R Efficiency & System Workflow Adoption Update

**Date**: 2026-04-11T23:24  
**Author**: Optimizer (Mode D: Workflow Health)  
**Status**: Complete  
**Baseline**: `finding-workflow-health-0410.md` (Apr 10)

## Executive Summary

**Mixed results.** The P1 budget cap is working exactly as intended — Phase 1 avg dropped from 30.4 to **6.8 ops (78% reduction)**. But total D-o-R run cost hasn't improved: **44.3 ops/run** (was 45.7). Phase 2 and Research Thread sessions absorbed the savings, averaging 24.9 and 51.1 ops respectively. Zero nesting incidents since the triple-fix deployment (17:30 UTC), confirming fix effectiveness.

System workflow adoption **jumped**: 57.8% of work sessions on Apr 11 use workflows (up from 38.1% on Apr 10). Optimizer is now a workflow user (27% of sessions). Verify-wrap is live with 14/16 verification sessions at 0 ops — nearly free overhead.

The D-o-R overhead ratio vs non-WF sessions has **not improved**: D-o-R 44.3 vs non-WF 22.8 = **+94% overhead** (was +53% on Apr 10). The increase is partly because non-WF sessions got leaner (22.8 from 29.9), widening the gap.

## 1. D-o-R Efficiency Post-Fixes

### Phase 1 Budget Cap: ✅ Working

| Metric | Pre-Cap (Apr 10) | Post-Cap (Apr 11) | Change |
|--------|:---:|:---:|:---:|
| **P1 avg ops** | 30.4 | **6.8** | **-78%** |
| P1 min | 5 | 2 | — |
| P1 max | 87 | 40 | -54% |
| P1 sessions | 36 | 19 | — |
| P1 ≤15 ops | ~50% | 89% (17/19) | — |

Only 2/19 P1 sessions exceeded 15 ops (one at 40, one at 11→debatable). The "BUDGET: 15 TOOL CALLS MAX" instruction is highly effective.

### Total Run Cost: ❌ No Improvement

| Metric | Apr 10 | Apr 11 | Change |
|--------|:---:|:---:|:---:|
| **Avg ops/run** | 45.7 | **44.3** | -3% (noise) |
| Run count | 34 | 22 | — |
| Total ops (all runs) | — | 974 | — |

**Where did the P1 savings go?** Phase 2 and Research Threads:

| Session Type | n | Avg Ops | Notes |
|-------------|:---:|:---:|---|
| Phase 1 (capped) | 19 | 6.8 | Working as designed |
| Phase 2 | 18 | 24.9 | Up from 18.8 — absorbing work that P1 used to do |
| Research Thread | 7 | 51.1 | Heavy parallel threads (79, 79, 51 ops each in one run) |

The work hasn't disappeared — it shifted downstream. P1 reads less, so P2 has to discover more context before writing. Research Threads are a newer Bob workflow pattern that runs multiple parallel work sessions per workflow run, each averaging 51 ops.

### Pre/Post Split Within Apr 11

| Period | Runs | Avg Ops/Run |
|--------|:---:|:---:|
| Before 12:00 UTC | 13 | 42.9 |
| After 12:00 UTC | 9 | 46.3 |

No significant difference within the day. The P1 cap was deployed early enough to affect most runs.

## 2. Nesting Incidents: ✅ Zero Post-Fix

| Period | D-o-R Sessions >50 ops | Nesting Incidents |
|--------|:---:|:---:|
| Pre all fixes (Apr 11 00:00–17:30) | Multiple | 3 confirmed |
| Post all fixes (17:30+) | 0 | **0** |

8 D-o-R sessions ran after 17:30 UTC. None exceeded 50 ops individually. The triple-fix (Phase 1 callAgent guard + Phase 2 callAgent guard + Phase 3 VERIFY nesting prevention) is confirmed effective with n=8 post-fix sessions.

## 3. System Workflow Adoption

### Daily Trend

| Day | Total Sessions | WF Sessions | Work Sessions | WF % (of work) | WF Ops | Total Ops | WF Ops % |
|-----|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Apr 9 | 575 | 60 | 140 | 42.9% | 1,116 | 8,849 | 12.6% |
| Apr 10 | 528 | 45 | 118 | 38.1% | 1,118 | 9,996 | 11.2% |
| Apr 11 | 555 | 78 | 135 | **57.8%** | 1,504 | 8,592 | **17.5%** |

**Apr 11 is the highest workflow adoption day.** Both session count (78, +73% vs Apr 10) and ops share (17.5%, +56% vs Apr 10) increased.

### By Agent (Apr 11)

| Agent | WF Sessions | Total Sessions | WF % | WF Ops | Total Ops |
|-------|:---:|:---:|:---:|:---:|:---:|
| Bob | 48 | 104 | **46%** | 975 | 1,800 |
| Optimizer | 28 | 104 | **27%** | 521 | 1,726 |
| Coder | 2 | 2 | 100% | 8 | 8 |
| Coach | 0 | 74 | 0% | 0 | 2,435 |
| Tech-Lead | 0 | 78 | 0% | 0 | 1,569 |
| Others | 0 | ~190 | 0% | 0 | ~2,000 |

**Key change**: Optimizer is now a workflow user (27% of sessions). This is new — optimizer had 0% workflow usage on Apr 10. The verify-wrap workflow was deployed for optimizer on Apr 11 ~16:24 UTC.

**Persistent gaps**: Coach (0%), Tech-Lead (0%) remain non-adopters. Coach has the second-highest ops (2,435) with zero workflow structure.

### Workflow Types (Apr 11)

| Type | Agent | Sessions | Ops |
|------|-------|:---:|:---:|
| D-o-R (Phase 1/2/3) | Bob | 45 | 915 |
| D-o-R (analysis) | Optimizer | 12 | 168 |
| verify-wrap | Optimizer | 4 | 62 |
| verify-wrap | Bob | 3 | 60 |
| Other | Coder | 2 | 8 |

D-o-R remains the dominant workflow. verify-wrap is the only new workflow gaining traction.

## 4. Verify-Wrap Adoption

### Overview

12 total verify-wrap sessions across 4 agents:

| Agent | Sessions | Avg Ops | Total Ops |
|-------|:---:|:---:|:---:|
| Coach | 4 | 34.5 | 138 |
| Bob | 3 | 20.0 | 60 |
| Optimizer | 4 | 15.5 | 62 |
| Tech-Lead | 1 | 26.0 | 26 |

Coach sessions are *about* verify-wrap (designing/deploying EXP-138/139), not *using* it. Bob and optimizer are the actual users.

### Optimizer Verify-Wrap Pattern

14 optimizer workflow runs on Apr 11 use the work→verify pattern:

- **Work session**: avg 36.5 ops (the actual analysis work)
- **Verify session**: avg 5.2 ops overall, but **14/16 are 0-op** (essentially free)
- **Verify overhead**: ~0% effective overhead (verify reads but doesn't count as ops in 87.5% of cases)
- **Success rate**: 14/14 runs completed (100%)

The verify-wrap workflow adds almost zero cost while providing structural verification. This is the model for low-overhead workflow value.

## 5. Error Rates (Apr 11)

| Type | Sessions | Errors | Error % |
|------|:---:|:---:|:---:|
| Workflow | 78 | 0 | **0.0%** |
| Non-workflow | 478 | 5 | 1.0% |

Workflow error rate is 0% (n=78) vs 1.0% non-workflow. On Apr 10, workflow was 2.1% vs 3.9%. Both improved, but workflow's perfect score on a larger sample is notable.

## Conclusions

### What Improved Since Apr 10
1. **Phase 1 budget cap works** — 78% reduction in P1 ops (30.4 → 6.8)
2. **Zero nesting incidents** post triple-fix (n=8 clean sessions)
3. **Workflow adoption up** — 57.8% of work sessions (was 38.1%)
4. **Optimizer adopted workflows** — 27% of sessions (was 0%)
5. **Verify-wrap is nearly free** — 87.5% of verify sessions are 0-op
6. **Error rate improved** — 0% workflow errors (was 2.1%)

### What Didn't Improve
1. **Total D-o-R run cost unchanged** — 44.3 ops (was 45.7). P1 savings absorbed by P2 bloat
2. **D-o-R overhead ratio worsened** — +94% vs non-WF (was +53%). Non-WF got leaner too
3. **Coach/TL still zero workflow adoption** — largest non-adopter agents

### Root Cause: Waterbed Effect
The P1 cap successfully constrains Phase 1, but the work shifts to Phase 2. A "plan less, write more" P1 means P2 must discover context it didn't get from P1. This is a **waterbed problem** — pressing down P1 pushes up P2. The total work required for a task is relatively fixed; the workflow phases just redistribute it.

## Recommendations

### R1: P2 Budget Cap (15-20 ops) — HIGH PRIORITY
Apply the same budget discipline to Phase 2. "Write deliverables in ≤20 tool calls. Don't explore — use the plan from Phase 1." This directly targets the waterbed effect.

### R2: Research Thread Constraints — MEDIUM
Bob's Research Thread sessions average 51 ops with no budget. Cap at 30 ops or split into smaller sub-threads.

### R3: Continue Verify-Wrap Expansion — LOW
Verify-wrap at ~0% overhead is the right model. Expand to coach work sessions where 0% adoption + 2,435 ops/day = biggest opportunity for structural improvement.

### R4: Track Run-Level Metrics — MEDIUM
Per-session averages hide workflow overhead. Build run-level tracking (total ops per workflowRunId) into routine monitoring.

---

*Methodology: All data from `.state/may.db`. 556 sessions on Apr 11, 78 workflow sessions, 22 D-o-R runs (Bob), 14 optimizer verify-wrap runs. Timestamps in epoch ms. Excluded running sessions.*
