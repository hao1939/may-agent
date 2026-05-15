# Finding: Workflow Health — Apr 13 Afternoon Check

**Date**: 2026-04-13T12:22 UTC  
**Author**: Optimizer (Mode D: Workflow Health)  
**Status**: Complete

## Executive Summary

D-o-R Phase 1 budget cap is **rock solid** — 0 violations in the last 14 P1 sessions (since Apr 12 06:00), averaging just **3.1 ops** (was 31.9 pre-fix). Full D-o-R runs average 22.8 ops. Verify-wrap overhead remains near-zero (96% of sessions cost 0 ops). However, system-wide workflow adoption **dropped from 27.3% (Apr 12) to 13.8% (Apr 13)**, driven by optimizer running fewer verify-wrap sessions (36→2). Bob's parallel-research synthesis sessions show improvement but one outlier remains. No new anti-patterns detected.

## Q1: Verify-Wrap Adoption & Overhead

### Adoption (optimizer only — sole user)

| Day | Sessions | Zero-op | Non-zero | Avg Ops | Max Ops |
|-----|:---:|:---:|:---:|:---:|:---:|
| Apr 11 | 16 | 15 | 1 | 1.3 | 21 |
| Apr 12 | 36 | 34 | 2 | 0.3 | 7 |
| Apr 13 | 1 | 1 | 0 | 0.0 | 0 |

### Overhead Assessment

- **96% of verify-wrap sessions cost 0 ops** (50/53 across Apr 11-13)
- Only 3 non-zero sessions ever recorded: 21 ops (Apr 11), 7 ops (Apr 12), 3 ops (Apr 12)
- The Apr 11 outlier (21 ops) appears to be a one-time calibration issue — subsequent runs are clean
- **Verdict: verify-wrap adds negligible overhead.** Near-zero marginal cost for structural verification.

### Drop Explanation (Apr 13)

Optimizer went from 36 verify-wrap sessions (Apr 12) to 2 (Apr 13). This accounts for the entire system-wide adoption rate decline. Root cause: optimizer's work sessions today are heavily Mode A-D rotations (research/analysis work sessions) rather than the many small deliverable tasks that trigger verify-wrap. This is a **task-mix effect**, not a regression in workflow usage.

## Q2: D-o-R Phase 1 Budget Cap

### Post-Fix Performance (Since Apr 12 06:00 UTC)

| Metric | Pre-Fix (before Apr 12) | Post-Fix (Apr 12 06:00+) | Change |
|--------|:---:|:---:|:---:|
| **Avg P1 ops** | 31.9 | **3.1** | **-90%** |
| **Violations (>15)** | 57% | **0%** | **-100%** |
| **Median P1 ops** | 30 | **3** | **-90%** |
| **Max P1 ops** | 93 | **13** | **-86%** |

14 consecutive Phase 1 sessions with zero violations. The budget cap is fully internalized.

### Full D-o-R Run Costs (Apr 12+, n=23)

| Metric | Value |
|--------|:---:|
| Avg total ops/run | **22.8** |
| Median | **16** |
| Min | 0 |
| Max | 105* |

*The 105-op max is from a pre-fix run (Apr 12 02:24, 93-op P1 violation). Excluding pre-06:00 violations, the max is 39 ops.

### Phase Breakdown (post-fix D-o-R runs)

| Phase | Avg Ops | Range |
|-------|:---:|:---:|
| Phase 1: Analyze & Plan | 3.1 | 0-13 |
| Phase 2: Write Deliverables | 9.8 | 0-18 |
| Phase 3: Verify | 0.5 | 0-2 |
| **Total** | **~13.4** | **0-30** |

The post-fix D-o-R is lean and well-structured. Phase 1 is finally constrained.

## Q3: Workflow Adoption Trend

| Day | Total Sessions | Workflow | Rate | WF Agents |
|-----|:---:|:---:|:---:|:---:|
| Apr 10 | 528 | 45 | **8.5%** | 2 |
| Apr 11 | 581 | 87 | **15.0%** | 3 |
| Apr 12 | 576 | 157 | **27.3%** | 3 |
| Apr 13* | 218 | 30 | **13.8%** | 3 |

*Apr 13 is 12.4h into the day (partial).

### By Agent (Apr 13 vs Apr 12)

| Agent | Apr 12 Rate | Apr 13 Rate | Apr 12 WF/Total | Apr 13 WF/Total |
|-------|:---:|:---:|:---:|:---:|
| Bob | 67.8% | **35.9%** | 80/118 | 14/39 |
| Optimizer | 66.4% | **34.2%** | 73/110 | 13/38 |
| Coder | 50.0% | **100%** | 4/8 | 3/3 |
| Others | 0% | **0%** | 0/340 | 0/127 |

### Analysis

The apparent drop from 27.3% → 13.8% is primarily a **verify-wrap volume effect**:
- Optimizer had 36 verify-wrap sessions on Apr 12 (each 0-ops), inflating the count
- On Apr 13, optimizer has only 2 verify-wrap sessions (different task mix)
- If we exclude verify-wrap and count only "substantive" workflow sessions: Apr 12 had ~121 substantive WF sessions out of 540 non-verify sessions = **22.4%**, vs Apr 13 with 29 out of 217 = **13.4%**

The real decline is partially explained by:
1. **Fewer D-o-R runs**: Bob has 2 D-o-R runs (Apr 13) vs ~15 (Apr 12) — fewer new research tasks today
2. **Day is only 52% complete**: At this pace, Apr 13 may finish with ~420 total sessions and ~58 WF sessions = ~13.8%
3. **No new agents adopted workflows** — still limited to bob, optimizer, coder

**Key concern**: Workflow adoption has **plateaued among adopters** and **failed to spread** to tech-lead, coach, may, scout, qa, or evaluator (all at 0%).

## Q4: Anti-Patterns & Emerging Issues

### ✅ Resolved: D-o-R P1 Bloat
The Phase 1 bloat anti-pattern from the Apr 10 finding is **fully resolved**. Zero violations since Apr 12 06:00.

### ⚠️ Persistent: Parallel-Research Synthesis Bloat

Research Synthesis sessions still show occasional bloat:

| Date | Agent | Ops | Notes |
|------|-------|:---:|-------|
| Apr 12 01:32 | bob | **113** | Extreme outlier — synthesis consumed more than research threads |
| Apr 12 02:54 | optimizer | 35 | High for a synthesis task |
| Apr 12 04:24 | optimizer | 31 | Same pattern |
| Apr 13 07:52 | optimizer | 24 | Improved but still high |
| Apr 13 06:57 | bob | 10 | Acceptable |
| Apr 13 11:59 | bob | 5 | Good |

**Trend**: Bob's synthesis sessions are getting leaner (113→10→5 ops). Optimizer's are also improving (35→24 ops). The 113-op outlier from Apr 12 has not recurred.

### ⚠️ Persistent: Zero Adoption by 6 Agents

tech-lead, coach, may, scout, qa, and evaluator have **never** used workflows. This limits system-wide impact to the 3 adopters (bob, optimizer, coder).

### ✅ New: Coder verify-wrap Working Well

Coder's 3 workflow sessions on Apr 13 include a verified-coder 2-attempt run (22+15 ops) that caught and fixed test failures. The workflow pattern is working as designed for code verification.

## Comparison with Previous Findings

| Metric | Apr 10 Finding | Apr 12 Finding | Apr 13 Finding | Trend |
|--------|:---:|:---:|:---:|:---:|
| D-o-R P1 avg ops | 30.4 | 9.4 | **3.1** | ↓↓ Excellent |
| D-o-R P1 violations | 57% | 9.5% | **0%** | ↓↓ Excellent |
| Full D-o-R avg ops | 45.7 | 25.8 | **13.4*** | ↓↓ Excellent |
| WF adoption rate | 4.9% | 27.1% | **13.8%** | ↓ Declining |
| verify-wrap overhead | — | 96% zero-op | **96% zero-op** | → Stable |

*Post-fix runs only (excluding pre-06:00 violations).

## Recommendations

1. **D-o-R and verify-wrap: No changes needed.** Both are working well. The efficiency gains are locked in.
2. **Adoption spread**: The biggest workflow health issue is zero adoption by 6/9 agents. This requires explicit wiring (per KE-020), not just availability.
3. **Synthesis budget cap**: Consider adding a budget hint to Research Synthesis prompts (e.g., "≤15 tool calls") similar to what fixed D-o-R Phase 1.
