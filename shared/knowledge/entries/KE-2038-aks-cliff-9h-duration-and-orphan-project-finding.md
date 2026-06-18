---
id: KE-2038
title: "AKS Cliff at 9h Duration — DB Stable, Orphan Project Health Finding Is evaluator-planner-aftermath-calibration"
date: 2026-06-18
author: arc
status: active
tags: [aks-explorer, throughput, system-health, infrastructure, project-health]
related: [KE-2037, KE-2035, KE-2034, KE-2033]
last_verified: 2026-06-18T19:45Z
---

<ai_context>
summary: The AKS-explorer throughput cliff (first documented in KE-2033 at ~10:30Z Jun 18) is now 9h+ old with no recovery. AKS sessions dropped from 100-144/hr to 1-3/hr at 10:30Z and remain there. Total sessions in the last 6h: 6 (all metric-alert-triage, no project planner or task-worker sessions). The DB stabilized at 1640 MB — only 28 MB growth since the 1612 MB post-VACUUM baseline 10h ago, confirming KE-2034's proportionality thesis. The 2000 MB threshold has ~69h headroom at this rate. Arc's 0-op error sessions (s_1781809303431_77, s_1781805703600_68) are provider-level failures (1.6s duration, 0 ops) — similar pattern appears for aks-explorer (26 0-op errors) and evaluator (6 0-op errors) in 24h. This is a transient provider issue, not a session logic bug. The project.health.finding-count=1 metric points to evaluator-planner-aftermath-calibration, which has 0 tasks despite active status — it was created by arc's Jun 18 01:10Z heartbeat and the evaluator has not yet created task slices for it.
triggers: heartbeat health check, KE-2037 cliff continuation monitoring
falsifiers:
  - F1: "If aks-explorer resumes at >50/hr within 12h of this entry (by Jun 19 08Z), the cliff duration stays in the 10-12h range consistent with Jun 16's 10h cliff." — Compare recovery timing.
  - F2: "If DB growth jumps to >15 MB/h when throughput resumes, KE-2034's proportionality model (30 MB/h at 100 sess/hr) holds and the P1 proposals for lifecycle event task stripping (KE-2035) become urgent." — Watch growth rate at next recovery.
  - F3: "If evaluator-planner-aftermath-calibration gets tasks created by evaluator within 24h, the health finding auto-resolves." — Watch project.health.finding-count metric.
</ai_context>

## Observation

### AKS Cliff Timeline Update (19:45Z Jun 18)

The cliff continues unabated at 9h+:

| Window | AKS Sessions | Pattern |
|--------|:-----------:|---------|
| 24h ago → 10:30Z | 1,693 | 78-144/hr continuous |
| 10:30Z → 19:45Z (9h15m) | 11 | 1-3/hr, metric-alert-triage only |

**No recovery signature detected.** Unlike Jun 16's cliff (which showed a planner burst at 03Z before full recovery at 06Z), there are no planner sessions firing — the task tree appears fully exhausted or stuck.

### DB Size Stability

| Time | DB (MB) | Growth |
|------|---------|--------|
| 09:31Z (post-VACUUM) | 1612 | baseline |
| 19:45Z (+10h) | 1640 | +28 MB (2.8 MB/h) |

Growth rate is even lower than KE-2034's 5.2 MB/h estimate (measured at 16:05Z). The cliff has effectively paused DB growth. At 2.8 MB/h, threshold breach is ~128h away. **But this reverses instantly when aks-explorer resumes** — prior rate was 30 MB/h.

### Arc's 0-Op Error Sessions

Two arc sessions errored at 0 ops in the last 6h:
- `s_1781809303431_77`: 1.6s duration, 0 ops (provider failure)
- `s_1781805703600_68`: 1.7s duration, 0 ops (provider failure)

This is a known transient provider pattern — 34 0-op errors across 3 agents in 24h:
- aks-explorer: 26
- evaluator: 6
- arc: 2

All are sub-2s sessions that fail before the first tool call. Not worth investigating further; provider retries handle this.

### Project Health Finding: evaluator-planner-aftermath-calibration

The `project.health.finding-count=1` metric points to `evaluator-planner-aftermath-calibration` (arc-created 2026-06-18 01:10Z, owned by evaluator). The health finding is `owner_judgment_needed`: "Active project has no tasks; owner should create the next task slice or close the project." This is expected — arc created the project with a plan but no task slices; the evaluator (as owner) needs to break the plan into tasks. The health-check fires every 30 min (18 findings in 24h) creating noise but is mechanically correct.

## System Coherence Audit: standing-orders.md

All 8 active orders verified current:
- ORDER-001 (idle time): accurate
- ORDER-002 (actions over words): accurate
- ORDER-003 (workflows for structured work): accurate — references `agents.fork()`, workflow dispatch, `verified-coder`
- ORDER-004 (no turn budgets): accurate — threshold numbers match (40 warn / 60 block)
- ORDER-008 (May dispatch): accurate
- ORDER-009 (guard changes need review): accurate — `shared/guards/loader.ts` confirmed exists
- ORDER-010 (src code needs Hao approval): accurate
- ORDER-014 (re-judge on plan completion): accurate

No stale references, ghost workflows, or outdated tool names found.

## Implications

1. **The cliff is the dominant system dynamic.** All other metrics are green or explained by the cliff (aftermath-coverage=0, evaluator skips, etc.). The single actionable thing is aks-explorer's task tree state.
2. **DB pressure is deferred, not resolved.** The 3 P1 proposals on the work-queue (lifecycle event task stripping, digest task dedup, DB threshold raise) remain the right response. The cliff just buys time.
3. **The evaluator-planner-aftermath-calibration project needs evaluator attention** to create task slices. The current health finding is noise from arc creating the project structure without the evaluator breaking it into actionable tasks.
