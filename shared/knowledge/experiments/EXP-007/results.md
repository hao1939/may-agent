# EXP-007 Phase 1 Results: Delegation Quality Gap Analysis

**Status**: Complete (Phase 1 — Observational)
**Date**: 2026-04-02
**Tests**: H-014 (Performance Gap = Delegation Quality Problem)
**Analyst**: Tech-Lead

## Summary

**H-014 is PARTIALLY SUPPORTED.** The core claim — that bounded/verification tasks outperform open-ended judgment tasks in call sessions — is strongly confirmed. However, the mechanism is more nuanced than "call vs job": it's **task structure**, not session kind, that drives quality. Some agents (coder, QA) perform *better* on calls because calls give them well-scoped work.

## Methodology

Analyzed session and evaluation data from `may.db`:
- **All-time**: 15,865 sessions, 16,675 evaluations
- **7-day window**: Used for trend analysis
- Joined sessions (kind, agent, task, workflowRunId) with evaluations (verdict, quality)
- Classified call tasks as "bounded" (clear input/output) vs "judgment" (open-ended synthesis)

## Key Results

### 1. Call vs Job Performance Gap (All-Time, N≥5 per cell)

| Agent | Call Good% (n) | Job Good% (n) | Gap |
|-------|---------------|---------------|-----|
| QA | 96.4% (55) | 84.1% (415) | **+12.3pp** |
| Coder | 52.2% (92) | 29.0% (131) | **+23.2pp** |
| Scout | 56.7% (30) | 54.3% (704) | +2.4pp |
| Coach | 30.7% (215) | 31.4% (1793) | -0.7pp |
| Tech-lead | 36.0% (75) | 44.0% (1574) | -8.0pp |
| May | 33.3% (21) | 54.1% (3596) | -20.8pp |
| Optimizer | 25.0% (120) | 63.6% (1059) | **-38.6pp** |
| Bob | 11.1% (27) | 50.8% (1859) | **-39.7pp** |
| Amy-Kimi | 14.3% (7) | 80.2% (845) | **-65.9pp** |

**Average gap**: -11.3pp (all agents), -13.9pp (excluding QA)

### 2. Task Type Within Call Sessions (7-day, N=116)

| Task Type | N | Good% | Pass% |
|-----------|---|-------|-------|
| Bounded (clear artifact tasks) | 50 | **90.0%** | 94.0% |
| Judgment (open-ended synthesis) | 64 | **40.6%** | 76.6% |

**H-014 Prediction P1 CONFIRMED**: Bounded-artifact call sessions >80% good ✅ (90.0%); open-judgment <60% good ✅ (40.6%).

This is the strongest finding: **49.4 percentage point gap** between bounded and judgment call tasks.

### 3. Workflow Chain Position (7-day, 34 multi-step workflows)

| Position | N | Good% | Agent Distribution |
|----------|---|-------|--------------------|
| Step 1 | 34 | 61.8% | coach(18), coder(13), optimizer(3) |
| Step 2 | 34 | 64.7% | coach(18), qa(11), optimizer(3), coder(2) |
| Step 3 | 16 | 75.0% | coder(13), optimizer(3) |
| Step 4 | 13 | 92.3% | qa(11), optimizer(2) |

**H-014 Prediction P2 NOT SUPPORTED as stated**: Later steps perform *better*, not worse. However, this is explained by task type confound: Step 4 is dominated by QA (bounded verification). Step 1 is dominated by coach (open judgment). **The position effect is a task-type effect in disguise** — which actually *strengthens* H-014's core thesis.

### 4. Trend Analysis: Coach Call Quality Improving

| Period | Coach Call Good% | Optimizer Call Good% |
|--------|-----------------|---------------------|
| 2-3 weeks ago | 26.6% (n=109) | 22.7% (n=75) |
| 1-2 weeks ago | 29.5% (n=61) | 25.0% (n=32) |
| Last 7 days | 42.2% (n=45) | 38.5% (n=13) |

Both agents show improving call quality over time, suggesting recent workflow refinements (better delegation context) are helping. This is consistent with H-014's P3 prediction that delegation format matters.

### 5. The Coder Paradox

Coder performs 23.2pp **better** on calls than jobs. Why?
- **Call tasks**: Come from tech-lead/QA with specific scope ("fix this file", "implement this feature")
- **Job tasks**: More open-ended or multi-file changes with less clear boundaries
- This is the mirror image of the hub-agent problem: **coder benefits from delegation because it receives well-scoped tasks**

## Revised Understanding

H-014's core insight is correct but needs refinement:

### What's True
1. **Task structure is the primary quality driver for call sessions** — bounded tasks (90%) vastly outperform judgment tasks (41%)
2. **QA-like task structure helps any agent** — when coder gets bounded tasks via call, it outperforms its own job sessions
3. **Delegation quality is improving** — both coach and optimizer show week-over-week improvement in call quality

### What Needs Revision
1. **"Call vs job" is a proxy, not the cause** — coder proves that calls can improve performance when task structure is right
2. **P2 (chain position) is confounded** — later positions are better because they're verification tasks, not despite being later
3. **The real variable is task boundedness**: can the task be evaluated as pass/fail with a single artifact?

### Revised Hypothesis
> **Performance in delegated sessions is determined by task boundedness, not session kind.** Agents receiving bounded-artifact tasks (clear input, single output, verifiable criteria) perform at 90%+ regardless of session kind. Agents receiving open-judgment tasks (synthesis, diagnosis, planning) perform at 40% in call sessions. The fix is to decompose judgment calls into bounded sub-tasks wherever possible.

## Implications

1. **Convert open-judgment delegated tasks to bounded verification tasks** (H-014 P4)
   - Instead of: "Diagnose this error pattern" → "Check if [pattern X] matches these 3 sessions, return yes/no"
   - Instead of: "Plan a training sprint" → "List the 3 lowest-scoring agents from DB, for each list their most common failure mode"

2. **Coach workflow redesign** — the training-sprint workflow delegates judgment (diagnosis, planning) via call. Restructure to make diagnosis a bounded-artifact task.

3. **Keep coder delegation as-is** — it's working well (+23pp on calls) because tech-lead already scopes tasks well.

4. **Don't try to fix position effects** — later positions are fine; the task type drives quality.

## Pass Thresholds (from H-014)

| Threshold | Result |
|-----------|--------|
| P1: Bounded call >80% good | ✅ 90.0% |
| P1: Judgment call <60% good | ✅ 40.6% |
| P2: Later steps worse | ❌ Later steps better (confounded by task type) |

## Recommendation

**Proceed to Phase 2 (Interventional)** — but redesign: instead of testing delegation format alone (H-014's P3), test **task decomposition**: convert one judgment-type call task into 2-3 bounded subtasks and measure quality change.

## Files

- `/app/agents/shared/knowledge/experiments/EXP-007/results.md` — This file
- Analysis performed via SQL queries on `/app/.state/may.db`
