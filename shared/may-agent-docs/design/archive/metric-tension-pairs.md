# Metric System + Gym Fast Feedback — Unified Design & Development Plan

**Status:** For Hao's approval  
**Date:** 2026-04-16  
**Supersedes:** metric-tension-pairs.md, gym feedback drafts

---

## Part 1: Agent Metrics (Role-Aligned, Speed-Tiered)

### Design Principles
1. **Metrics signal where agents should go** — drive growth, not just reflect current state
2. **Tension pairs share concerns from different perspectives** — balance, not opposition
3. **Metrics are signals, not targets** — inform judgment, not replace it
4. **Different speeds for different metrics** — fast (every heartbeat), medium (daily), slow (weekly)
5. **Gym accelerates slow metrics** — 20-minute validation instead of days of production data

### Tension Pairs
- **Bob ↔ Tech-lead:** "What to build" vs "How to build it well." Shared concern: gain capability without gaining complexity.
- **Coach ↔ Optimizer:** "Agent quality" vs "Agent efficiency." Shared concern: perform well without waste.

### Full Metric Set

#### May — System Oversight
| Metric | Type | Speed | Signal |
|--------|------|-------|--------|
| `system.request-throughput` | health | daily | Are human requests getting done? |
| `system.stuck-requests` | health | fast | Is anything blocked right now? |
| `system.agent-utilization` | continuous | daily | Is every agent producing? |

#### Bob — Architect
| Metric | Type | Speed | Signal |
|--------|------|-------|--------|
| `bob.experiment-completion` | health | fast | Am I finishing what I start? |
| `bob.hypotheses-resolved` | continuous | slow | Is the research loop closing? |
| `bob.designs-implemented` | continuous | slow | Are my designs becoming real? |

#### Tech-lead — Engineer
| Metric | Type | Speed | Signal |
|--------|------|-------|--------|
| `tech-lead.build-health` | health | fast | Is the codebase healthy right now? |
| `tech-lead.meaningful-changes` | continuous | daily | Am I shipping impactful work? |
| `tech-lead.codebase-weight` | continuous | slow | Is the system getting simpler? |
| `tech-lead.delegation-quality` | continuous | daily | Am I scoping tasks well for coder? |

#### Coach — Trainer
| Metric | Type | Speed | Signal |
|--------|------|-------|--------|
| `coach.intervention-hit-rate` | continuous | fast (via gym) | Do my interventions actually work? |
| `coach.skill-effectiveness` | continuous | daily | Are deployed skills having impact? |
| `coach.knowledge-to-action-latency` | continuous | daily | How fast do I act on findings? |

#### Optimizer — Tool & Workflow Builder
| Metric | Type | Speed | Signal |
|--------|------|-------|--------|
| `optimizer.tool-adoption` | continuous | daily | Are agents using what I build? |
| `optimizer.analysis-accuracy` | continuous | daily | Are my diagnoses correct? |
| `optimizer.quality-preserved` | health | slow | Am I preserving quality? |

#### Scout — Explorer
| Metric | Type | Speed | Signal |
|--------|------|-------|--------|
| `scout.hypotheses-generated` | continuous | daily | Am I synthesizing, not just summarizing? |
| `scout.findings-used` | continuous | slow | Is my research actionable? |
| `scout.coverage` | health | fast | Am I scanning regularly? |

#### Coder / Evaluator / QA
| Agent | Metrics |
|-------|---------|
| Coder | `quality` (continuous), `first-pass-rate` (continuous) |
| Evaluator | `calibration` (health), `coverage` (health) |
| QA | `review-coverage` (health), `false-positive-rate` (continuous) |

---

## Part 2: Gym as Fast Feedback

### Core Idea
Gym gives signal in 20 minutes that would otherwise take days of production data. It's a **validation gate and smoke test**, not a development target.

### How Each Role Uses Gym

| Role | Gym Use | Cadence |
|------|---------|---------|
| **Coach** | A/B test interventions — 10 trials before/after skill deployment | Every intervention (~daily) |
| **Optimizer** | Pre-deploy validation — run workflow scenarios before shipping | Every harness/workflow change |
| **Tech-lead** | Regression gate — run smoke tier after code changes | Every significant merge |
| **Bob** | Component skill validation — test verification/navigation skills | When deploying skill changes |
| **Scout** | Output quality testing — test if DDs are actionable | Needs new scenarios first |

### Gym Rules
1. **Gym results don't directly update production metrics** — they're a separate fast signal
2. **Don't chase gym pass rates** — Goodhart's Law. Fix agents and scenarios; the number follows
3. **Gym is a smoke test, not proof** — catches regressions fast, production metrics are the real scorecard

### Scenario Triage (295 → focused set)
1. **Tier by discrimination:** 0% or 100% pass → archive or use as regression canary. 20-80% → keep
2. **Tag by role:** Most scenarios are coder-focused. Tag which agent/skill each scenario tests
3. **Fix broken scenarios:** 0% across all agents = scenario is probably broken, not agents
4. **Add role-specific scenarios:** Scout has near-zero coverage. Needs 10-15 research scenarios
5. **Target: ~100 curated scenarios** with known discrimination, tagged by role and skill

### Gym-Metric Integration
```
Production metric signals a problem
    → Agent diagnoses root cause  
    → Agent designs intervention
    → Gym validates intervention (10 trials, 20 min)
    → If pass rate improves → deploy to production
    → If not → iterate or discard
    → Production metric confirms over next 24-48h
```

Coach's intervention-hit-rate becomes a FAST metric because gym provides same-day signal.

---

## Part 3: Development Plan

### Milestone 1: Seed Role-Aligned Metrics (1 session)
**Owner:** May  
**Worker:** Tech-lead  
**What:** Replace the current 20 generic metrics with the role-aligned set above. UPDATE existing metrics, INSERT new ones, ARCHIVE irrelevant ones.  
**Deliverable:** ~25 metrics in may.db matching this design, auto-measurement queries working.

### Milestone 2: Scenario Triage (1-2 sessions)  
**Owner:** Coach  
**Worker:** Coach  
**What:** Run baseline on all 295 scenarios. Tag each with: discrimination tier (archive/keep/broken), role tag, relevant skill. Produce a triage report.  
**Deliverable:** `agents/gym/TRIAGE.md` — which scenarios to keep, fix, or archive. Target: ~100 curated scenarios.

### Milestone 3: Coach Fast Loop Pilot (1-2 sessions)
**Owner:** Coach  
**Worker:** Coach  
**What:** Pick one low-pass scenario. Design an intervention. Run 10-trial A/B. Record result as `coach.intervention-hit-rate` snapshot. Prove the fast feedback loop works.  
**Deliverable:** One completed A/B cycle with gym data feeding metric snapshot.

### Milestone 4: Optimizer Pre-deploy Gate (1 session)
**Owner:** Optimizer  
**Worker:** Optimizer  
**What:** Define 5 workflow scenarios as the pre-deploy smoke battery. Run before next harness change. Record pass rate.  
**Deliverable:** `agents/optimizer/workspace/pre-deploy-battery.md` — scenarios + expected pass rates.

### Milestone 5: Scout Scenario Creation (2-3 sessions)
**Owner:** Scout  
**Worker:** Scout + Coder  
**What:** Create 10 Scout-specific gym scenarios — paper evaluation, synthesis quality, hypothesis formulation, duplicate detection.  
**Deliverable:** 10 new scenarios in `agents/gym/scenarios/` with success criteria.

### Milestone 6: Agent Heartbeat Integration (behavioral)
**Owner:** May  
**Worker:** Each agent  
**What:** Each agent adds metric query to their heartbeat observation step. Fast metrics checked every heartbeat, medium daily, slow weekly.  
**Deliverable:** All agents referencing their metrics in heartbeat sessions.

---

## Part 4: How to Drive It

**Yes, persistent task.** May owns the overall project. Each milestone is a persistent-task iteration or a forked sub-task.

Project file: `agents/may/workspace/projects/metrics-and-gym.md`

```markdown
# Task: Metrics + Gym Fast Feedback

**Status**: active
**Owner**: may
**Started**: 2026-04-16

## Milestones
- [ ] M1: Seed role-aligned metrics (tech-lead)
- [ ] M2: Scenario triage (coach)
- [ ] M3: Coach fast loop pilot (coach)
- [ ] M4: Optimizer pre-deploy gate (optimizer)
- [ ] M5: Scout scenario creation (scout + coder)
- [ ] M6: Agent heartbeat integration (all)
```

May dispatches each milestone to the right agent via `agents.fork()`. She monitors progress in her heartbeat. Each milestone is independent — they can run in parallel where possible (M2+M3 can overlap, M4+M5 can overlap).

The persistent task drives the overall project. Individual milestones use whatever execution mechanism fits — fork, workflow, or the agent's own heartbeat work.

**Expected timeline:** M1-M3 can complete within 2-3 days. M4-M5 within a week. M6 is ongoing adoption.
