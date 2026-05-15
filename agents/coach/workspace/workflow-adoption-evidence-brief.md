# Workflow-First Adoption: Evidence & Status Brief

**Date**: 2026-04-12 05:30 UTC  
**Author**: Coach  
**Purpose**: Answer Hao's question — "What is the status of our workflow first approach for agents harnessing?"

---

## TL;DR

Workflow adoption is **working but incomplete**. Current data shows 74 workflow runs in the last 48 hours (51% of all sessions), with strong concentration in 3 workflows. The approach is proven effective by evidence, but adoption is still partial and fragile — it requires explicit wiring, not just availability.

---

## 1. Current Adoption Numbers (Last 48h)

| Workflow | Runs | Done | Escalated | Done% |
|----------|------|------|-----------|-------|
| `deliver-or-report` (Bob) | 39 | 16 | 23 | 41% |
| `verify-wrap` (EXP-138 post-verification) | 26 | 26 | 0 | **100%** |
| `parallel-research` (Bob/Scout) | 6 | 6 | 0 | **100%** |
| `implement-and-verify` (shared) | 3 | 1 | 1 | 33% |
| **Total** | **74** | **49** | **24** | **66%** |

**Coverage**: 74 workflow runs out of ~145 total sessions = **51% of sessions routed through workflows**.

## 2. Historical Comparison

| Period | Workflows in Use | Run Count | Notes |
|--------|-----------------|-----------|-------|
| Pre-March 23 | 5 (growth-cycle, implement-and-review, skill-lifecycle, training-sprint, verified-coder) | 59 total (over weeks) | Coach-dominated |
| Post-Apr 1 heartbeat rewrite | 0 | **0** | EXP-028: 51pp degradation, workflow collapse |
| After fix + current (last 48h) | 4 (deliver-or-report, verify-wrap, parallel-research, implement-and-verify) | **74** | 63 in last 24h alone |

**Key shift**: From coach-only usage to Bob + cross-agent usage. This is the "workflow-first" transition actually happening.

## 3. What the Evidence Says

### 3a. Why Workflows Work (Confirmed)

| Finding | Source | Evidence |
|---------|--------|----------|
| **KE-007**: Workflow enforcement is the only reliable behavioral intervention | 55 experiments | 4 workflows promoted, text rules = 0% |
| **KE-015**: Decision topology R predicts workflow effectiveness | EXP-009, EXP-011, EXP-013, EXP-016 | ρ=0.95, 80% prediction accuracy |
| **KE-020**: Agents need explicit wiring, not just availability | EXP-028 | 0% spontaneous adoption |
| **KE-052**: Structural access > content quality | EXP-051/052/053 | Access structure predicts utilization |
| **EXP-144**: Structured gates provide auditability + speed | Phase 1, N=50 | Format mandate = 16% faster + 100% compliance |

### 3b. Known Limitations

| Issue | Evidence | Impact |
|-------|----------|--------|
| `deliver-or-report` 41% done rate | 23/39 escalated | Bob's primary workflow needs tuning |
| `implement-and-review` broken | 6% done rate (14/16 escalated, verdict parsing) | Fixed but not re-adopted |
| Guards not internalizing | FM-3.3 fire rate: 29%→61% over time | Guards = permanent infra, not training |
| Workflow adoption is fragile | EXP-028 showed instant collapse on heartbeat rewrite | Must protect wiring explicitly |

### 3c. What's NOT Measured Yet

- **No A/B test**: No controlled experiment of workflow vs non-workflow for the same agent on the same task type in current period
- **No quality signal**: We know done rate, not quality rate for current workflows
- **Bob's ghost deliverable regression**: C1.5 violations suggest workflow gates aren't catching everything

## 4. The "Workflow-First" Architecture

Current state of the approach:

```
Agent Heartbeat
  ├─ Triage (dispatcher pattern, KE-024)
  │   └─ Task classified → routed to appropriate workflow
  ├─ Bob: deliver-or-report (39 runs) ✅
  ├─ Bob: parallel-research (6 runs) ✅  
  ├─ Shared: verify-wrap (26 runs) ✅
  ├─ Shared: implement-and-verify (3 runs) ⚠️ underused
  └─ Unstructured work (~71 sessions, 49%) ⚠️ still bypassing
```

## 5. What Needs to Happen Next

### Immediate (P0)
1. **Fix `deliver-or-report` escalation rate** — 59% escalation is too high, likely over-sensitive
2. **Wire `implement-and-verify` into more agent heartbeats** — only 3 runs despite being the "workhorse"

### Short-term (P1)  
3. **Measure quality** — need production quality signal for workflow vs non-workflow sessions
4. **EXP-145 (Guard Dependency Escalation)** — understand why guards aren't internalizing
5. **Route the remaining 49% of sessions** — identify which unstructured sessions could benefit

### Medium-term (P2)
6. **Controlled A/B test** — current-period workflow vs direct for same tasks (EXP-001 was early, confounded)
7. **New workflows for gap areas** — research tasks, reflection tasks, observation tasks

## 6. Bottom Line

The workflow-first approach is **directionally correct and gaining traction**:
- 51% session coverage (up from 0% post-heartbeat-rewrite)
- 63 runs in the last 24 hours
- Bob has adopted workflows (deliver-or-report, parallel-research)
- verify-wrap is 100% reliable

But it's **not yet mature**:
- deliver-or-report needs tuning (41% done)
- 49% of sessions still unstructured
- No quality measurement in production
- Fragile — depends on heartbeat wiring that can be accidentally removed

**The fundamental insight (KE-007 + KE-020) remains validated**: workflows work, but agents must be wired to use them. The question is no longer "should we do workflow-first?" but "how do we close the remaining adoption gaps?"
