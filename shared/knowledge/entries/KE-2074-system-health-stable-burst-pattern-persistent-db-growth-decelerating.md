---
id: KE-2074
title: "System Health Stable — Burst-Crash Pattern Persistent, DB Growth Decelerating"
date: 2026-06-20
author: arc
status: active
tags: [system-health, heartbeat, synthesis, burst-crash, db-size, metrics-verification]
related: [KE-2055, KE-2072, KE-2069, KE-2056, KE-2064]
last_verified: 2026-06-20T09:30Z
---

<ai_context>
summary: "System health check at 2026-06-20 09:30Z. All 50 active metrics are green (no threshold breaches). Key falsifier verifications: (1) KE-2055 burst-crash pattern holds at 72.8% planner sessions in 7d, 1.57% zero-op error rate among aks-explorer (250/16k sessions), consistent and not worsening; (2) KE-2072 DB threshold at 2500 MB holding, DB size 1976 MB, growth rate decelerated from 27 MB/h (KE-2071 measurement) to ~15 MB/h, pushing breach ETA from ~20h to ~35h; (3) KE-2064 negative-duration anomaly still 1/17353 (7d), confirmed one-off; (4) KE-2056 triage rate recovered to 1.0 (was 0.556 during burst). Overall: error rate 2.8% (6h), handler success rate 99.89%, evaluator aftermath coverage 100%, all agents running (heartbeat coverage 3/2 target). Dormant agents (bob, coach, optimizer) have no heartbeats scheduled and last ran 7-9+ days ago. Standing orders verified accurate except ORDER-003 line 17 (proposal already filed). 4 proposals filed in work-queue from prior session, all correctly formatted."
triggers: [arc heartbeat, system health check, falsifier verification]
falsifiers:
  - F1: "If DB growth re-accelerates above 25 MB/h in the next 12h, the deceleration observation is transient." — Monitor infra.persist.db-size-mb at next heartbeat.
  - F2: "If burst zero-op error rate for aks-explorer rises above 3% (24h), the pattern is worsening." — Currently 1.57%, was 2.9% in KE-2055's 7d window.
  - F3: "If evaluator real-error rate (opCount>0 errors / total) rises above 2%, investigate evaluator-specific failure mode." — Currently 12/1069 = 1.12% (24h).
</ai_context>

# KE-2074: System Health Stable — Burst Pattern Persistent, DB Growth Decelerating

## System Snapshot (2026-06-20 ~09:30Z)

### Agent Effectiveness (24h)

| Agent | Sessions | Done | Error | Error% | Avg Ops |
|-------|----------|------|-------|--------|---------|
| aks-explorer | 2037 | 1978 | 47 | 2.3% | 17.0 |
| evaluator | 1061 | 1041 | 18 | 1.7% | 25.8 |
| scout | 107 | 103 | 3 | 2.8% | 41.1 |
| may | 94 | 83 | 5 | 5.3% | 41.9 |
| arc | 46 | 44 | 1 | 2.2% | 70.7 |
| dev | 46 | 46 | 0 | 0% | 7.8 |

### Key Metrics

| Metric | Current | Threshold | Status |
|--------|---------|-----------|--------|
| DB size | 1976 MB | 2500 MB | OK (21% headroom) |
| Session error rate (6h) | 2.8% | 30% | OK |
| Handler success rate | 99.89% | 80% | OK |
| Evaluator aftermath coverage | 100% | 20% | OK |
| Failed triage rate | 100% | 80% | OK |
| Guard triggers (24h) | 3752 | 5500 | OK |

## Falsifier Verifications

### KE-2055: Burst-crash pattern (HOLDS)
- Planner sessions = 72.8% of zero-op errors (7d) — matches KE-2055's 72.5%
- Rate: 1.57% of aks-explorer sessions (24h) are zero-op errors
- Pattern is **persistent and stable**, not worsening
- Burst anatomy unchanged: 10+ sessions crash in <5s window, 1-2 succeed after

### KE-2072: DB threshold raise (F2 CHECK)
- DB size moved from 1942.55 MB (07:15Z) to 1976.31 MB
- Growth rate: ~15 MB/h (decelerated from KE-2071's 27 MB/h)
- New breach ETA: ~35h (was ~20.7h at old rate)
- Deceleration may be load-dependent (fewer sessions overnight); recheck at peak

### KE-2064: Negative duration (CONFIRMED ONE-OFF)
- Still 1/17,353 sessions (7d) with endedAt < startedAt
- No new occurrences since the original observation

### KE-2056: Triage rate (RECOVERED)
- session.failed-triage-rate-3h = 1.0 (was 0.556 during burst window)
- Recovery confirms the breach was burst-noise, not genuine triage failure

## Standing Orders Audit

Verified `shared/standing-orders.md` against current system:

| Order | Status | Notes |
|-------|--------|-------|
| ORDER-001 | Accurate | — |
| ORDER-002 | Accurate | — |
| ORDER-003 | **Stale line 17** | "project handler dispatches tasks" — handler still exists but project-apps are the active model. Proposal filed: 2026-06-20-standing-orders-003-project-handler-fix.md |
| ORDER-004 | Accurate | cost-limit guard confirmed at 40/60 thresholds |
| ORDER-008 | Accurate | — |
| ORDER-009 | Accurate | shared/guards/loader.ts exists |
| ORDER-010 | Accurate | — |
| ORDER-014 | Accurate | — |

Also noted: ORDER-003 references `workflow.run("verified-coder", ...)` (tech-lead). The workflow file exists at `agents/tech-lead/workflows/verified-coder.ts`. Tech-lead has run only 2 sessions in 7d (last: 2026-06-13). The reference is currently accurate but the agent is effectively dormant.

## Dormant Agents

4 agents with config files but no heartbeats and no recent sessions:
- **bob**: 0 sessions in 14d retention window
- **coach**: 0 sessions in 14d retention window  
- **optimizer**: last session 2026-06-11 (9 days ago)
- **tech-lead**: last session 2026-06-13 (7 days ago)

These are not frozen (they have valid agent.json configs) but have no cron-scheduled heartbeats. Standing orders still reference some of them (ORDER-003: tech-lead). No action needed unless the reference becomes confusing for active agents.

## Proposal Status

4 proposals filed to work-queue in prior session, all correctly formatted:
1. [P2] Guards REGISTRY.md stale path fix (KE-2073)
2. [P2] Add `idle` to common-sense.md session status (KE-2063)
3. [P2] Fix 4 residual stale shared/workflows/ refs (KE-2050)
4. [P2] Fix standing-orders.md ORDER-003 stale handler ref (KE-2053)

All await human review.
