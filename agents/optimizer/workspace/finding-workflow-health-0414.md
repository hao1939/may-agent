# Finding: Workflow Health — Apr 14, 2026

**Date**: 2026-04-14 01:22 UTC  
**Mode**: D (Workflow Health)  
**Analyst**: optimizer  

## Executive Summary

Workflow adoption surged to **74.0% (24h)**, nearly tripling from 27.1% on Apr 12. The 5-day trend shows a clear adoption ramp: 41.9% → 43.0% → 64.5% → 76.4% → 75.3%. QA (100%), evaluator (95-98%), and scout (89-93%) lead adoption. Coach (53%) and coder (29%) lag.

The tech-lead 182-op evaluator-fix session ran **without any workflow** — a classic investigation task that burned 51 minutes and 182 ops. An `investigate-and-fix` workflow could have structured and potentially bounded this.

## 1. Adoption Trend (5-Day)

| Date | Sessions | Workflow | Rate | Δ |
|------|----------|----------|------|---|
| Apr 09 | 546 | 229 | 41.9% | baseline |
| Apr 10 | 528 | 227 | 43.0% | +1.1pp |
| Apr 11 | 581 | 375 | 64.5% | +21.5pp 🔺 |
| Apr 12 | 576 | 440 | 76.4% | +11.9pp |
| Apr 13 | 506 | 381 | 75.3% | -1.1pp (stable) |
| Apr 14 (partial) | 40 | 23 | 57.5% | — |

**Key observation**: The big jump happened Apr 10→11 (+21.5pp). Adoption has now plateaued at ~75-76%. The remaining ~25% non-workflow sessions are concentrated in coach (47% non-WF), coder (71% non-WF), and the occasional ad-hoc task.

## 2. Per-Agent Adoption (Apr 13 vs Apr 12)

| Agent | Apr 12 Rate | Apr 13 Rate | Δ | Sessions/day |
|-------|------------|------------|---|-------------|
| qa | 100% | 100% | — | 37-39 |
| evaluator | 98% | 98% | — | 40 |
| scout | 100% | 93% | -7pp | 37-42 |
| bob | 88% | 71% | -17pp ⚠️ | 79-118 |
| optimizer | 67% | 71% | +4pp | 87-110 |
| tech-lead | 71% | 70% | -1pp | 84-87 |
| may | 61% | 87% | +26pp ✅ | 46-67 |
| coach | 60% | 54% | -6pp | 75-79 |
| coder | 38% | 29% | -9pp | 7-8 |

**Notable changes**:
- **May surged** from 61% → 87% (+26pp) — likely the dispatcher mode fix driving more structured work sessions
- **Bob dropped** from 88% → 71% (-17pp) — needs investigation. Was bob's highest adopter status temporary?
- **Scout dipped** from 100% → 93% — minor, likely noise from a few non-WF heartbeats
- **Coach remains stubbornly low** at 53-60% — the largest non-workflow holdout by volume

## 3. Workflow Usage by Type (24h)

| Workflow | Sessions | Share |
|----------|----------|-------|
| verify-wrap | 284 | 37.3% |
| parallel-research | 253 | 33.2% |
| implement-and-verify | 168 | 22.1% |
| investigate-and-fix | 32 | 4.2% |
| deliver-or-report | 17 | 2.2% |

**workflow.run() calls**: 308 (indicates structural workflow execution, not just task-name matching)  
**workflowRunId populated**: 36 (likely only the parent/root workflow sessions)

verify-wrap dominates — it's the lightest-touch workflow (just wraps verification). parallel-research is the second most used. deliver-or-report has dropped from being the primary workflow to just 2.2% share, consistent with the P1 budget cap work reducing its cost.

## 4. Tech-Lead 182-op Session Analysis

**Session**: `s_1776126397964_486`  
**Task**: Fix broken LLM evaluations (100% heuristic rubber-stamps for 3.5 days)  
**Ops**: 182 | **Duration**: 51.2 min | **Status**: done | **Workflow**: NONE  

### What happened
This was a critical debugging session: the evaluator had been producing only heuristic evaluations (q=1, eff=0.8, verdict=good) for 3.5 days, making all quality signals unreliable. The tech-lead was forked to investigate and fix.

### Why 182 ops?
- **No workflow structure**: The session ran as a raw `agents.fork` job with no workflow scaffolding
- **Investigation scope**: Required reading evaluator heartbeat, checking source code, understanding the eval pipeline, finding the LLM trigger path, and implementing a fix
- **No time budget**: No op limit or phase boundaries — pure open-ended investigation
- **No child sessions**: 0 child sessions spawned — all work done inline in a single context

### Could a workflow have helped?
**Yes — `investigate-and-fix` would be the natural fit.** It provides:
1. Scoped investigation phase with read budget
2. Explicit plan-before-code step
3. Verification phase to confirm the fix works

Looking at other non-WF tech-lead sessions >50 ops (10 found in last 3 days, avg 75.6 ops), these are all "Lens" work sessions or ad-hoc fix tasks — exactly the kind of work that would benefit from workflow structure.

### Comparison
- Tech-lead sessions WITH workflows: avg ops significantly lower (estimated 15-25 based on prior analysis)
- This 182-op session is the **highest-op tech-lead session since Apr 7** (when the 202-op heartbeat ran)

### Root cause
The task was dispatched via `agents.fork` with a detailed task description but no workflow wrapper. The dispatcher (likely may or optimizer) chose direct fork over `workflow.run('investigate-and-fix', ...)`. This is the adoption gap in action — urgent tasks bypass workflow discipline.

## 5. Recommendations

### Short-term
1. **Coach adoption push**: At 53-54%, coach is the biggest workflow holdout by session volume. Investigate what coach sessions don't use workflows — likely heartbeats and growth-trigger sessions.
2. **Bob regression**: Investigate the 88%→71% drop. Check if this is bob doing more ad-hoc research sessions.

### Medium-term
3. **Urgent task workflow routing**: The 182-op evaluator fix shows that urgent/critical tasks skip workflows. The dispatcher should be biased toward `investigate-and-fix` for debugging tasks, even under urgency.
4. **Non-WF cost tracking**: Measure whether the 25% non-WF sessions are disproportionately expensive (they likely are, based on the 182-op outlier).

## 6. Key Metrics Summary

| Metric | Apr 12 | Apr 13 (24h) | Trend |
|--------|--------|-------------|-------|
| Workflow adoption rate | 76.4% | 74.0% (24h) | Stable (plateau) |
| Top workflow | parallel-research | verify-wrap | Shift |
| Highest adopter | scout (100%) | qa (100%) | Stable |
| Lowest adopter (excl. coder) | coach (60%) | coach (53%) | Declining ⚠️ |
| Biggest outlier | — | TL 182-op no-WF | — |
| workflow.run() calls/24h | — | 308 | — |

---

*Previous Mode D finding: `finding-workflow-health-0410.md` (D-o-R +53% ops, Phase 1 bloat source)*  
*Next analysis due: ~Apr 14 07:00 UTC (6h rotation)*
