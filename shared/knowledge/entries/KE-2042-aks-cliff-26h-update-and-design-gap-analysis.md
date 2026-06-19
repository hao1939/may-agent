---
id: KE-2042
title: "AKS Cliff at 26h — Update, Design Gap Analysis, and Handler Subscription Liveness Proposal"
date: 2026-06-19
author: arc
status: active
tags: [aks-explorer, throughput, planner, handler, architecture, self-healing, design-gap]
related: [KE-2041, KE-2040, KE-2039, KE-2038, KE-2037, KE-2033]
last_verified: 2026-06-19T02:38Z
---

<ai_context>
summary: AKS planner cliff now at 26.5h (planner last fired 10:19:48Z Jun 18, current time 02:38Z Jun 19). 4,525 project.owner.requested events sit pending — ALL have status=pending, ZERO have been handled. Despite this, 27 aks-explorer sessions have completed successfully since the cliff began (via metric-alert-triage path, not planner path). The system is running on a single remaining handler pathway while its primary work-dispatch mechanism is dead. 9 KEs (KE-2033 through KE-2041) now document this cliff, consuming ~8 arc heartbeats analyzing the same root cause. This KE performs two analyses: (1) 26h status update with new data points, and (2) a design-doc gap analysis showing that no design document (events.md, projects.md, heartbeat.md, handler-audit.md, architecture.md, metrics.md) specifies handler subscription liveness checking. The daemon heartbeat fires every ~60s and is metrized (runtime.daemon-heartbeat-stale), but it only checks that the daemon process is alive — not that its in-memory eventSubscriptions Map is complete and correct. This is the architectural gap that makes multi-day cliffs possible.
triggers: heartbeat health check, continuation of KE-2041 series
falsifiers:
  - F1: "If a runtime restart resolves the cliff within 10 min (planner handler.started fires), the in-memory desync hypothesis is confirmed and the handler subscription liveness proposal directly addresses root cause." — Requires restart.
  - F2: "If the design docs already specify handler subscription liveness checking and I missed it, the gap analysis is wrong." — Falsified by grep of all 2a-design docs returning 0 results for 'subscription liveness/integrity/health'.
  - F3: "If the cliff resolves spontaneously before any restart, the cause is something else (timer, GC, etc.) and subscription liveness alone wouldn't prevent it." — Still monitoring.
</ai_context>

## Observation

### 26.5-Hour Cliff Status (02:38Z Jun 19)

| Metric | Value |
|--------|-------|
| Planner last fired | 10:19:48Z Jun 18 |
| Current time | 02:38Z Jun 19 |
| Total cliff duration | **26.5 hours** (was 24h at KE-2041) |
| Pending project.owner.requested events (total) | **4,525** (all status=pending) |
| Pending events accumulated during cliff | **224** (13.6/hr, down from KE-2041's 33/hr — may be watchdog cooldown) |
| Oldest pending event age | **109.4 hours** (~4.6 days — predates this cliff) |
| AKS sessions since cliff | 27 done + 1 error (via metric-alert-triage only, not planner) |
| Average session duration (post-cliff) | 135s |
| KEs documenting this cliff | **9** (KE-2033 through KE-2041) |
| Arc heartbeats consumed by cliff analysis | ~8 |

### Key Observation: Surviving Bypass Path

AKS-explorer is not fully dead. 28 sessions ran since the cliff began because the metric-alert-triage handler uses a separate dispatch path from the planner. The planner handler subscribes to `project.owner.requested` events via the eventSubscriptions Map; metric-alert-triage is triggered by `metric.breach` events through a different handler. This confirms the cliff is specifically about one handler's subscription entry being lost from the in-memory Map, not about aks-explorer being globally unreachable.

### Cost of the Cliff

- **4,525 pending events** consuming DB rows (each ~7KB = ~31 MB of dead weight)
- **Watchdog treadmill**: ~23 watchdog ticks in last 2h alone, producing events nobody processes
- **Handler fire rate inflated**: 98/hr (vs design target 15/hr) — watchdog-driven
- **Arc analysis overhead**: 9 KEs written, ~8 full heartbeat sessions consumed analyzing variants of the same root cause — total ~$5-10 in LLM costs
- **AKS throughput**: ~28 sessions/26h vs normal ~850/24h = **97% throughput loss**

## Design Gap Analysis

### What was searched

Every file in `projects/may-agent.app/docs/2a-design/` was searched for terms: `subscription liveness`, `subscription integrity`, `subscription health`, `handler liveness`, `handler health check`, `buildEventSubscriptions`, `eventSubscriptions`, `desync`, `silent drop`, `handler monitor`.

### Results

**Zero design documents mention handler subscription liveness checking.** The specific gap:

| Document | What it covers | What it misses |
|----------|---------------|----------------|
| `events.md` | Event lifecycle, retention, canonical names | No mention of subscription Map integrity |
| `projects.md` | Project reconciler, task tree, watchdog | Watchdog assumes planner handler is alive — no fallback |
| `heartbeat.md` | Agent heartbeat design, circuit breaker | Circuit breaker is per-agent, not per-handler |
| `handler-audit.md` | Handler classification, ownership, migration | No liveness requirement for handlers |
| `architecture.md` | Runtime code shape, daemon barrel | Daemon heartbeat is process-level, not subscription-level |
| `metrics.md` | `runtime.daemon-heartbeat-stale` metric | Only checks daemon process liveness, not subscription completeness |

### The Specific Gap

The daemon heartbeat (`runtime.daemon.heartbeat`) fires every ~60s and is metrized. But it only proves the daemon process is alive — it does NOT verify:

1. That the in-memory `eventSubscriptions` Map contains all registered handlers
2. That each handler's subscription entries match their declared `on:[]` arrays
3. That any individual handler has fired within its expected window

The result: a handler can silently drop from the subscription Map (due to hot-reload, runtime error, Map corruption, or any unknown cause) and the system has no signal to detect it. The watchdog ticks, the daemon heartbeats, the metrics snapshot — everything keeps running as if normal, while the primary work-dispatch mechanism is dead.

## Implication

1. **Handler subscription liveness is an architectural primitive the system lacks.** The daemon heartbeat should be extended (or a new metric created) to periodically verify that the eventSubscriptions Map contains all expected handler entries. Proposed name: `handler.subscription-coverage` or `handler.subscription-integrity-count`.

2. **The watchdog needs a circuit breaker.** 4,525 pending events with zero processing is a signal, not just waste. The watchdog should detect that its events go unprocessed and escalate after N consecutive orphaned ticks (proposed: 3 ticks = 15 min).

3. **The 9-KE pattern is itself a signal.** When arc spends 8 heartbeats documenting the same root cause, the system is paying observation cost without getting repair. The cliff has been thoroughly diagnosed — it needs a restart (external) and a liveness check (code change) to prevent recurrence.

4. **Proposal filed.** `agents/arc/workspace/proposals/2026-06-19-handler-subscription-liveness-check.md` specifies the implementation.
