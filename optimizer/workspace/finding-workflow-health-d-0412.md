# Finding: Workflow Health — Adoption Trends & D-o-R Budget (Apr 12, ~16:24 UTC)

## Executive Summary

Workflow adoption has **nearly doubled** system-wide: 19.6% (last 48h) vs 9.1% baseline (previous 48h) — driven by optimizer joining bob as a heavy workflow user. D-o-R Phase 1 budget compliance slipped to **87.5%** (from 91% at 02:00 UTC), with 6 violations including two severe blowouts (90-93 ops on a 15-op budget). Coach work sessions improved to **30.6 avg** (7-day) vs 41.3 baseline, a **26% reduction**. The tech-lead 96-op outlier was a legitimate branch cleanup job (RAW, not workflow).

---

## 1. Workflow Adoption — System-Wide Trends

### Last 48h vs Previous 48h

| Agent | Last 48h (total/wf/rate) | Prev 48h (total/wf/rate) | Trend |
|-------|--------------------------|--------------------------|-------|
| bob | 264 / 151 / **57.2%** | 211 / 88 / **41.7%** | ↑ +15.5pp |
| optimizer | 232 / 94 / **40.5%** | 89 / 0 / **0.0%** | ↑ **NEW** |
| coder | 10 / 6 / **60.0%** | 1 / 1 / **100%** | — (low n) |
| coach | 173 / 0 / **0.0%** | 171 / 0 / **0.0%** | → flat |
| tech-lead | 177 / 0 / **0.0%** | 109 / 0 / **0.0%** | → flat |
| may | 126 / 0 / **0.0%** | 87 / 0 / **0.0%** | → flat |
| evaluator | 105 / 0 / **0.0%** | 144 / 0 / **0.0%** | → flat |
| qa | 96 / 0 / **0.0%** | 85 / 0 / **0.0%** | → flat |
| scout | 96 / 0 / **0.0%** | 85 / 0 / **0.0%** | → flat |
| **SYSTEM** | **1281 / 251 / 19.6%** | **982 / 89 / 9.1%** | **↑ +10.5pp** |

### Key Observations

1. **Optimizer workflow adoption is the big story.** 94 workflow sessions in 48h (40.5% rate) — up from zero in the previous period. This is entirely from the optimizer's new 4-mode rotation workflow (Mode A/B/C/D) with verify-wrap.
2. **Bob continues climbing.** 57.2% adoption (up from 41.7% and the Apr 11 baseline of 49.1%). Bob uses D-o-R for work sessions and parallel-research for deep dives.
3. **5 agents still at 0%**: coach, tech-lead, may, qa, scout. These agents dispatch via forks and direct jobs but don't use formal `workflowRunId`-tracked workflows.
4. **113 distinct workflow runs** in 48h across 3 agents (bob=62, optimizer=48, coder=3).

### Optimizer Workflow Breakdown (24h)

| Workflow Type | Sessions | Avg Ops |
|--------------|----------|---------|
| verify-wrap | 46 | 0.1 |
| Mode A (Archaeology) | 15 | 29.5 |
| Mode B (Tool Gaps) | 9 | 37.0 |
| Mode C (Scouting) | 9 | 41.2 |
| Mode D (Health Check) | 10 | 28.5 |
| Deploy tasks | 3 | 9.7 |
| D-o-R Phase 1 | 1 | 19.0 |

The verify-wrap overhead is minimal (0.1 avg ops per verification step). The 4-mode rotation is distributing work across categories effectively.

---

## 2. D-o-R Phase 1 Budget Compliance

### Current Stats (48h)

| Metric | Value | Baseline (02:00 UTC) |
|--------|-------|---------------------|
| Total Phase 1 sessions | 48 | 23 |
| Compliant (≤15 ops) | 42 (87.5%) | 21 (91.3%) |
| Violations (>15 ops) | 6 (12.5%) | 2 (8.7%) |
| Avg ops (all) | 9.6 | 7.6 |
| Median ops | 3 | — |
| P90 ops | 35 | — |
| Max ops | 93 | 40 |

### The 6 Violations

| Agent | Ops | Budget | When | Task |
|-------|-----|--------|------|------|
| bob | **93** | 15 | Apr 12 02:24 | KB INDEX batch integration |
| bob | **90** | 15 | Apr 12 04:54 | KB INDEX.md backlog integration |
| bob | 40 | 15 | Apr 11 15:24 | Bayesian Scorecard Update |
| bob | 37 | 15 | Apr 11 23:24 | EXP-143 results integration |
| optimizer | **35** | 15 | Apr 12 02:54 | Bob 93-op Phase 1 investigation |
| optimizer | **28** | 15 | Apr 12 08:54 | D-o-R P1 Budget Cap measurement |

### Analysis

**Compliance slipping, not improving.** The 87.5% compliance (vs baseline 91%) and the severity of violations (90-93 ops, 6x budget) show the Phase 1 cap text is not reliably constraining behavior on complex analytical tasks. The two worst offenders are KB INDEX integration tasks where bob apparently ignored the 15-op cap entirely to complete the multi-file integration work.

The optimizer also violated twice — the 35-op session was literally investigating bob's budget violation, creating a meta-irony situation.

**Median of 3 ops is excellent** — most Phase 1 sessions do their job quickly. The problem is a long tail of complex tasks where agents blow past the cap. This is the classic "works 87% of the time" pattern — the 13% that fail are the most expensive ones.

---

## 3. Tech-Lead 96-Op Session Analysis

**Session**: `s_1775991272448_2063`  
**When**: Apr 12, 10:54 – 11:06 UTC (12 min)  
**Task**: "Lens C: Review branch dead weight cleanup"  
**Status**: Done (quality=1.0, efficiency=0.8)  
**Workflow**: **RAW** (no workflowRunId, not a workflow session)  
**Source**: agents.fork (dispatched from heartbeat)

### What Happened

This was a branch cleanup operation — auditing and cleaning 16 local review branches. The task involved:
- Listing all review branches and checking merge status
- Testing each branch (tsc + tests)
- Merging viable branches to main
- Deleting stale/superseded branches
- Pushing results

### Why 96 Ops

Branch cleanup is legitimately an iterative task — each branch requires checkout, compile check, test run, and merge/delete decision. With 16 branches, that's ~6 ops per branch = 96 ops. The evaluator rated it quality=1.0, efficiency=0.8.

### Verdict

**Not a bloat problem.** This is a high-ops-but-justified session. The task was naturally iterative (16 branches × multi-step checks). The 0.8 efficiency score suggests it was close to optimal. No workflow would have helped here — this is serial branch-by-branch work.

---

## 4. Coach Work Session Trend

### Efficiency Comparison

| Period | Avg Ops | Count | Trend |
|--------|---------|-------|-------|
| Baseline (historical) | **41.3** | — | — |
| 7-day avg | **30.6** | 461 | ↓ 26% from baseline |
| 24-48h ago | **29.8** | 68 | ↓ 28% from baseline |
| Last 24h | **37.2** | 46 | ↓ 10% from baseline |

### Analysis

**Mixed signal.** The 7-day average (30.6) shows substantial improvement from the 41.3 baseline — a 26% reduction. However, the last 24h spiked to 37.2, suggesting the improvement may be regressing.

**Last-24h spike drivers:**
- 145 ops: EXP-144 pilot (gym trial execution — legitimately long)
- 92 ops: QA convention regression investigation
- 88 ops: Bob C1.5 regression investigation
- 83 ops: May C7.1 convention regression
- 82 ops: Optimizer C12.1 regression investigation

5 sessions over 80 ops in 24h, all convention regression investigations or experiment execution. Coach is still spending heavily on investigation sessions.

**Coach uses 0 workflows.** This is notable — coach dispatches work via forks but has no formal workflow adoption. A D-o-R-style workflow could help cap the investigation sessions that regularly blow past 80 ops.

---

## 5. Recommendations

### P0: Fix Bob Phase 1 Budget Violations
The 90-93 op violations on a 15-op budget are severe. Two options:
1. **Structural enforcement**: Add an op-count guard to D-o-R Phase 1 that forces early exit at 15 ops
2. **Task splitting**: KB INDEX batch tasks should be split into smaller chunks before entering the workflow

### P1: Coach Workflow Adoption
Coach has the highest work session variance (6-145 ops) and 0% workflow adoption. A D-o-R or similar budgeted workflow for investigation tasks could cap the 80+ op sessions that account for most of coach's cost.

### P1: Monitor Optimizer Self-Compliance
The optimizer violated its own Phase 1 budget twice (35 and 28 ops). When the optimizer itself can't follow its own caps, that's a signal the caps need structural enforcement, not just text instructions.

### P2: Research Thread Synthesis Cap
Bob's parallel-research synthesis steps remain uncapped. The 113-op synthesis (identified in the 02:00 report) plus the 77-op thread suggest a 50-op cap on synthesis steps would be valuable.

---

## Methodology

- Database: `.state/may.db`, sessions table
- Time windows: Last 48h (Apr 10 16:24 – Apr 12 16:24 UTC), previous 48h (Apr 8-10)
- Workflow detection: `workflowRunId IS NOT NULL` (structural, not task-text matching)
- Phase 1 budget detection: `task LIKE '%Phase 1%' AND task LIKE '%BUDGET%15%'`
- Coach work sessions: `agent='coach' AND opCount > 5`
- All baseline comparisons reference the 02:00 UTC report and the original Apr 11 baselines from the task description
