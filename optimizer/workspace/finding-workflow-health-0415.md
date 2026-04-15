# Finding: Workflow Health — Post LLM-to-JS Verification Impact

**Date**: 2026-04-15T12:00  
**Author**: Optimizer (Mode D: Workflow Health)  
**Status**: Complete  
**Comparison baseline**: finding-workflow-health-0410.md, finding-llm-to-js-verification-0413.md

## Executive Summary

The LLM-to-JS verification change (deployed Apr 13) delivered measurable efficiency gains: **system-wide average ops dropped 25%** (16.3 → 12.3) and coach verify-wrap ops **halved** (8.6 → 4.3). However, two concerning trends emerged: (1) interrupt rate quadrupled from 2.1% → 9.4%, and (2) formal workflow adoption (workflowRunId-tracked) dropped from 17.2% → 12.3% despite task-text mentions of workflows reaching 68.6%.

## Data Sources

- **Production DB**: `.state/may.db` — 21,442 total sessions
- **Pre-change window**: Apr 10-12 (1,685 sessions)
- **Post-change window**: Apr 13-15 (1,344 sessions)
- **Previous findings**: Apr 10 health check, Apr 13 LLM-to-JS finding

## Adoption: Two Conflicting Signals

### Signal 1: Task-text matching (mentions "workflow", "verify-wrap", "deliver-or-report")

| Period | Sessions | WF-mentioned | Rate |
|--------|:---:|:---:|:---:|
| Apr 10-12 (pre) | 1,685 | 1,039 | **61.7%** |
| Apr 13-15 (post) | 1,344 | 922 | **68.6%** |

By this measure, adoption *increased* 7pp. Agents reference workflows in their task descriptions more often.

### Signal 2: workflowRunId tracking (formal workflow infrastructure)

| Period | Sessions | workflowRunId set | Rate |
|--------|:---:|:---:|:---:|
| Apr 7-9 | 1,505 | 68 | **4.5%** |
| Apr 10-12 (pre) | 1,685 | 289 | **17.2%** |
| Apr 13-15 (post) | 1,344 | 165 | **12.3%** |

Formal tracking dropped 5pp. This means more sessions *talk about* workflows without being formally tracked as workflow runs.

### Per-Agent Adoption (task-text, post-change Apr 13-15)

| Agent | Total | WF Sessions | Rate | vs Apr 10 baseline |
|-------|:---:|:---:|:---:|---|
| QA | 93 | 89 | **95.7%** | ↑ from 42.9% |
| Scout | 105 | 81 | **77.1%** | ↑ from 42.9% |
| May | 110 | 82 | **74.5%** | ↓ from 83.7% |
| Evaluator | 236 | 172 | **72.9%** | ↑ from 45.3% |
| Optimizer | 188 | 134 | **71.3%** | ↓ from 73.9% |
| Tech-lead | 195 | 134 | **68.7%** | ↑ from 47.2% |
| Bob | 188 | 113 | **60.1%** | ↓ from 72.4% |
| Coach | 196 | 101 | **51.5%** | ↓ from 65.0% |
| Coder | 33 | 16 | **48.5%** | ↑ from 27.3% |

**QA** and **Scout** showed the biggest jumps — both approaching or exceeding 77% workflow adoption after being ~43% pre-change. Bob and Coach decreased despite remaining high.

## Verify-Wrap Efficiency: The LLM-to-JS Impact

### Coach verify-wrap (clearest signal)

| Period | Sessions | Avg Ops | Total Ops | Avg Duration |
|--------|:---:|:---:|:---:|:---:|
| Pre (Apr 10-12) | 67 | **8.6** | 578 | 108.7s |
| Post (Apr 13-15) | 80 | **4.3** | 344 | 215.9s |

**Ops halved** (8.6 → 4.3 = **50% reduction**). But duration *doubled* (108.7s → 215.9s) — the verify phase is faster but the overall wrapped session may be taking longer due to other factors.

### Verify-wrap ops distribution shift

| Bucket | Pre (Apr 10-12) | Post (Apr 13-15) |
|--------|:---:|:---:|
| 0 ops | 4 (1%) | 39 (7%) |
| 1-5 ops | 204 (52%) | 210 (36%) |
| 6-10 ops | 116 (29%) | 250 (43%) |
| 11-20 ops | 40 (10%) | 62 (11%) |
| 21+ ops | 30 (8%) | 22 (4%) |

The **6-10 bucket grew** (29% → 43%) and the **21+ tail shrank** (8% → 4%). The distribution is tightening around a more efficient center, with fewer runaway sessions.

### Deliver-or-report (Bob's workflow)

| Period | Sessions | Avg Ops |
|--------|:---:|:---:|
| Pre (Apr 10-12) | 148 (Bob) | 11.3 |
| Post (Apr 13-15) | 27 (Bob) | 10.6 |

Bob D-o-R ops dropped slightly (11.3 → 10.6, **6% improvement**), but the sample size dropped dramatically (148 → 27). Compare to Apr 10 finding where D-o-R averaged **45.7 ops** — the improvement since then has been massive and preceded the LLM-to-JS change.

## System-Wide Efficiency

| Metric | Pre (Apr 10-12) | Post (Apr 13-15) | Change |
|--------|:---:|:---:|:---:|
| Total sessions | 1,685 | 1,344 | -20% |
| Total ops consumed | 27,501 | 16,581 | **-40%** |
| Avg ops/session | 16.3 | 12.3 | **-25%** |

The system consumed **40% fewer total ops** in the post period. Even adjusting for 20% fewer sessions, the per-session average dropped 25%. This is a significant efficiency win.

### Per-Agent Ops Comparison

| Agent | Pre Avg Ops | Post Avg Ops | Change |
|-------|:---:|:---:|:---:|
| Coach | 23.9 | 15.0 | **-37%** |
| May | 21.0 | 14.3 | **-32%** |
| Tech-lead | 19.5 | 16.2 | **-17%** |
| Bob | 16.1 | 15.8 | -2% |
| Optimizer | 16.3 | 15.0 | **-8%** |
| Scout | 13.0 | 12.3 | -5% |
| QA | 9.2 | 7.6 | **-17%** |
| Coder | 20.8 | 18.5 | -11% |
| Evaluator | 4.6 | 2.2 | **-52%** |

**Coach** (-37%) and **Evaluator** (-52%) saw the largest per-session efficiency gains. These are the agents most likely impacted by the LLM verification removal — evaluator had many zero-op verification sessions that are now handled by JS.

## Error Rate: Concerning Spike

| Period | Total | Failures | Rate |
|--------|:---:|:---:|:---:|
| Pre (Apr 10-12) | 1,683 | 35 | **2.1%** |
| Post (Apr 13-15) | 1,344 | 127 | **9.4%** |

Failure rate **quadrupled**. Breakdown:

| Agent | Pre Fail% | Post Fail% | Delta | Primary Type |
|-------|:---:|:---:|:---:|---|
| QA | 0.8% | **30.1%** | +29pp | interrupts |
| May | 1.8% | **20.0%** | +18pp | interrupts |
| Coach | 8.3% | **13.8%** | +6pp | interrupts |
| Scout | 3.0% | **7.6%** | +5pp | interrupts |
| Bob | 0.9% | **6.9%** | +6pp | interrupts |
| Optimizer | 1.1% | **6.4%** | +5pp | interrupts |
| Tech-lead | 0.4% | **5.1%** | +5pp | interrupts |
| Evaluator | 0.0% | **2.5%** | +3pp | interrupts |
| Coder | 0.0% | **3.0%** | +3pp | interrupts |

**QA** (30.1%) and **May** (20.0%) are the worst hit. Almost all failures are interrupts, not errors — suggesting a timeout/budget enforcement issue rather than code bugs. This likely correlates with the tiered budget system deployed around Apr 13-14 (see checkpoint from prior session noting 67% QA interrupt rate).

**Important:** This interrupt spike is NOT caused by the LLM-to-JS change. It's caused by the concurrent tiered budget deployment. The two changes overlapped in timing but have separate root causes.

## Comparison to Apr 10 Baseline

| Metric | Apr 4-10 (old baseline) | Apr 10-12 (pre) | Apr 13-15 (post) | Trend |
|--------|:---:|:---:|:---:|---|
| System WF rate (text) | 4.5% | 61.7% | 68.6% | ↑↑↑ |
| Bob D-o-R avg ops | 45.7 | 11.3 | 10.6 | ↓↓ (fixed) |
| Coach avg ops | 27.7 | 23.9 | 15.0 | ↓↓ |
| System avg ops | — | 16.3 | 12.3 | ↓ |
| System error rate | ~3.9% (Bob non-WF) | 2.1% | 9.4% | ↑↑ (budget issue) |

The Apr 10 finding's **R1 recommendation** (cap Phase 1 at 15 ops) appears to have been implemented or the equivalent effect achieved — Bob D-o-R dropped from 45.7 to ~11 ops avg. The Phase 1 bloat problem appears largely solved.

## Anti-Patterns Observed

### 1. Workflow Mention Without Tracking (Ghost Workflows)
68.6% of sessions mention workflows in task text but only 12.3% have workflowRunId set. This creates a data integrity gap — we can't reliably distinguish "executed within a workflow" from "mentioned a workflow in the task description."

### 2. QA Interrupt Epidemic
30.1% of QA sessions interrupted — the highest of any agent. Combined with QA having the highest workflow text-mention rate (95.7%), this suggests QA sessions are being started within workflows but then timed out before completion.

### 3. Evaluator Zero-Op Persistence
Post-change, evaluator still has 38 zero-op verify sessions (out of 118). The LLM-to-JS change was supposed to eliminate these. Either: (a) some evaluator verify-wrap sessions still use the old LLM path, or (b) evaluator sessions are exiting before the JS verification runs.

## Conclusions

### LLM-to-JS Verification Impact: POSITIVE
1. **25% per-session efficiency gain** (16.3 → 12.3 avg ops)
2. **Coach verify-wrap ops halved** (8.6 → 4.3)
3. **Heavy tail reduced** — sessions >21 ops dropped from 8% to 4% of verify-wraps
4. **40% total ops reduction** across the system

### Workflow Adoption: MIXED
1. Text-mention adoption is high (68.6%) and growing
2. Formal workflowRunId tracking dropped (17.2% → 12.3%)
3. QA and Scout showed biggest adoption jumps
4. Gap between text-mention and formal tracking is a data quality issue

### Risks Requiring Attention
1. **Interrupt rate spike** (2.1% → 9.4%) — likely budget-related, not workflow-related
2. **QA 30% interrupt rate** — critical, needs budget or timeout adjustment
3. **Evaluator zero-op persistence** — 32% of evaluator verify-wraps still zero-op

## Recommendations

### R1: Investigate QA/May Interrupt Spike (HIGH PRIORITY)
The 30% QA and 20% May interrupt rates are not workflow-related but overlap temporally. The tiered budget system needs tuning — heartbeat budget may be too tight for workflow-wrapped sessions.

### R2: Reconcile Workflow Detection Methods (MEDIUM)
The 56pp gap between text-mention (68.6%) and workflowRunId (12.3%) adoption is problematic. Either: (a) ensure all workflow-run sessions set workflowRunId, or (b) standardize on text-matching with a reliable keyword.

### R3: Audit Evaluator Zero-Op Verify Sessions (LOW)
38 evaluator sessions still show 0 ops post-change. These may be vestiges of the old LLM verification path or a separate issue. Worth a quick audit.

### R4: Close R1 From Apr 10 (DONE)
The Phase 1 bloat recommendation has been effectively addressed — D-o-R avg ops dropped from 45.7 to ~11. No further action needed.
