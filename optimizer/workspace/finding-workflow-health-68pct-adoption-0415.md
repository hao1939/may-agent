# Finding: Workflow Adoption Deep Dive — Claimed 68%, Actual 28-32%

**Date**: 2026-04-15T21:01 UTC  
**Mode**: D (Workflow Health)  
**Author**: Optimizer  
**Status**: Complete

---

## Executive Summary

The claimed "68% workflow adoption" is **not supported by data**. Actual workflow adoption across the system is **28% of job sessions** (80/289) in the last 24h, up from 5% three days ago. This is still a significant surge — **5× growth in 3 days** — driven primarily by optimizer (83%), bob (48%), and tech-lead (28%). However, three agents (may, qa, scout) remain near 0% adoption, and the tree-cost data shows workflow-dispatching sessions consume **2.5-4.6× more total ops** than non-workflow sessions, raising the question of whether workflows are creating more work rather than reducing it.

**Critical methodological correction**: Previous analyses filtered on `kind='job'` which **excludes all workflow-dispatched sessions** (they are `kind='call'`). This is why some measurements showed 0% adoption. The correct query must join parent jobs to child calls via `parentSessionId`.

---

## 1. Actual Adoption Rates (Last 24h)

### By Agent (heartbeat jobs dispatching workflow calls)

| Agent | Jobs | Dispatching WF | Rate | Trend vs Apr 13 |
|-------|:----:|:--------------:|:----:|:---:|
| optimizer | 35 | 29 | **83%** | ↑ (was ~44%) |
| bob | 40 | 19 | **48%** | ↑ (was ~38%) |
| tech-lead | 64 | 18 | **28%** | ↑ (was ~11%) |
| coach | 44 | 10 | **23%** | ↑ (was ~33%) |
| scout | 34 | 3 | **9%** | new |
| qa | 31 | 1 | **3%** | ↔ (was 7%) |
| may | 41 | 0 | **0%** | ↔ |
| **Total** | **289** | **80** | **28%** | ↑ from 5% |

### Daily Trend (excl evaluator)

| Day | Jobs w/ WF | Total Jobs | Rate |
|-----|:----------:|:----------:|:----:|
| Apr 13 | 20 | 382 | **5%** |
| Apr 14 | 54 | 348 | **16%** |
| Apr 15 | 80 | 289 | **28%** |

**Growth is real** — 5× in 3 days. But 28% ≠ 68%. The 68% figure likely came from measuring only a subset of agents or a narrow time window.

---

## 2. What Workflows Are Being Used (24h)

| Workflow Type | Count | Avg Ops | Errors | Agents |
|---------------|:-----:|:-------:|:------:|--------|
| work-session (forked analysis/tasks) | 67 | 24 | 12 (18%) | optimizer(29), bob(27), coach(8), scout(3) |
| tech-lead-lens (code reviews) | 10 | 11 | 0 | tech-lead(9), coder(1) |
| experiment (EXP-*) | 5 | 22 | 2 | bob(2), coach(2), coder(1) |
| persistent-task iterations | 12 | 19 | 0 | coder(8), tech-lead(4) |
| deploy | 1 | 31 | 0 | coach |
| growth | 2 | 12 | 0 | coach |
| other (QA scans, reviews) | 18 | 14 | 1 | mixed |

**Dominant pattern**: "work-session" calls (58% of all WF calls). These are heartbeats forking focused analysis tasks via `agents.call()` with `workflowRunId`. The dispatcher model is working — heartbeats stay lean and fork work.

---

## 3. Efficiency Comparison: Workflow vs Non-Workflow

### Aggregate (24h, all agents excl evaluator)

| Metric | WF Calls | Non-WF Jobs | Delta |
|--------|:--------:|:-----------:|:-----:|
| Sessions | 115 | 289 | — |
| Avg ops/session | 21.1 | 12.3 | +72% |
| Error rate | 13.0% | 11.8% | +1.2pp |
| Total ops | 2,424 | 3,567 | — |

**Workflow sessions use more ops** — but this is expected because they're doing actual work (the parent heartbeat is lean). The right comparison is **tree cost** (parent + all children).

### Tree Cost: Heartbeats That Dispatch WF vs Those That Don't (24h)

| Agent | WF-Dispatching Trees | Non-WF Trees | Ratio |
|-------|:--------------------:|:------------:|:-----:|
| bob | 42.0 ops (n=16) | 9.1 ops (n=17) | **4.6×** |
| coach | 37.0 ops (n=10) | 7.2 ops (n=20) | **5.1×** |
| optimizer | 24.3 ops (n=28) | 10.5 ops (n=6) | **2.3×** |
| scout | 52.0 ops (n=3) | 7.9 ops (n=31) | **6.6×** |
| tech-lead | 36.8 ops (n=13) | 18.5 ops (n=28) | **2.0×** |

**Key insight**: WF-dispatching heartbeats produce 2-6.6× more total ops. But this isn't inefficiency — it's the **dispatcher pattern working as designed**. Non-WF heartbeats that don't fork work are either:
- Finding nothing to do (lean exit at ~7-10 ops)  
- Doing inline work (tech-lead at 18.5 avg — still doing work directly)

The relevant question is: **are WF-dispatching trees producing more VALUE per op?** The error rate data suggests partially yes — tech-lead WF calls have **0% error rate** vs 6.3% for non-WF. Coder WF calls have 5.6% error rate. But bob (23.3%) and coach (33.3%) have higher error rates in WF calls than the baseline.

---

## 4. D-o-R Bloat Check

The Apr 10 finding showed D-o-R workflows had **+53% more ops** (45.7 vs 29.9). Current data suggests this pattern persists but has shifted:

- **Tech-lead lens reviews** (the successor to D-o-R): avg 11 ops, 0% error rate — **lean and effective**
- **Work-session forks**: avg 24 ops — heavier but producing deliverables
- **Optimizer parent ops when dispatching**: 5.9 avg (down from 56 pre-fix) — **lean dispatcher working**

The D-o-R bloat specifically has been replaced by the "work-session" pattern. The 24-op average for work sessions is reasonable for tasks that produce files. The original concern (Phase 1 eating 67% of ops in the planning phase) appears resolved — work is now happening in the forked session, not the parent.

---

## 5. Non-Adoption Analysis: The Remaining 72%

### Structural Non-Adopters (0% adoption, expected)
- **Evaluator** (125 sessions/day): Automated evaluation — no workflow needed. Correctly excluded.
- **May** (41 sessions/day): Infrastructure/cron management. Heartbeats handle coordination directly. Could benefit from workflows for complex multi-step deploys, but current pattern is functional.

### Low Adopters (under-using workflows)
- **QA** (3%, 1/31): QA heartbeats do scan-verify-report cycles that are naturally short (6.8 avg ops). Workflows add overhead for tasks this small. **Structural barrier: QA's work is inherently lightweight.** Not a good candidate for workflow adoption.
- **Scout** (9%, 3/34): Scout heartbeats average 8.7 ops. Similar to QA — most scout work is "read, check, report" which doesn't benefit from the overhead of forking. The 3 sessions that DID use workflows had 52 avg tree ops — suggesting workflows are reserved for rare heavy tasks.

### Moderate Adopters (room to grow)
- **Coach** (23%): Down from 33% on Apr 13. Coach heartbeats that don't fork (7.2 avg ops) are lean. The ones that do fork (37 avg tree ops) are doing growth-cycle/experiment work. **Coach adoption is appropriate** — it forks when there's real work, stays lean otherwise.
- **Tech-lead** (28%): Improved from 11% to 28% in 24h. The lens review pattern is working well (11 avg ops, 0% errors). Still has some inline-heavy heartbeats (17.6 avg ops without forking). **Room to grow**: heartbeats with >15 ops that DON'T fork should be dispatching work sessions.

### High Adopters (model behavior)  
- **Optimizer** (83%): The dispatcher model is deeply embedded. Parent heartbeats average 5.9 ops when dispatching.
- **Bob** (48%): Nearly half of heartbeats dispatch workflows. Work sessions average 25.6 ops.

---

## 6. Recommendations

### Don't chase 68% or 100% — target the RIGHT adoption
Not all agents should use workflows equally. The data shows:
- **High-value targets**: tech-lead heartbeats >15 ops that don't fork (28 sessions/day at 18.5 avg ops). Converting these to fork would save 5-10 parent ops each.
- **Low-value targets**: QA and scout — their work is naturally lightweight, workflow overhead adds more than it saves.
- **Appropriate adoption**: ~35-40% system-wide (excl evaluator/may) would be optimal. We're at 28%, so modest growth of ~7pp is reasonable.

### Monitor the error rate gap
WF calls for bob (23.3%) and coach (33.3%) have significantly higher error rates than baseline. This suggests either:
- WF-dispatched tasks are harder (positive: harder work is being delegated properly)
- WF framing is introducing errors (negative: needs investigation)

### The D-o-R bloat is resolved
The original +53% bloat from Phase 1 planning is no longer the pattern. Work sessions average 24 ops and produce deliverables. The dispatcher model successfully moved work from parent heartbeats to child sessions.

---

## Methodology Note

**Critical correction**: Previous workflow health findings (Apr 10-13) filtered on `kind='job'` which systematically excluded all workflow-dispatched sessions (`kind='call'`). The correct measurement joins parent sessions (kind='job') with child sessions (kind='call', workflowRunId IS NOT NULL) via `parentSessionId`. This finding uses the corrected methodology throughout.
