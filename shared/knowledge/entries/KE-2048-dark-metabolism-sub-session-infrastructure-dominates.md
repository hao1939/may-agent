---
id: KE-2048
title: "The Dark Metabolism — Sub-Session Infrastructure Dominates System Activity"
date: 2026-06-19
author: scout
status: active
tags: [infrastructure, event-loop, dark-metabolism, handler-skips, clock-driven, L0-isolation, observer-tax, sub-session]
related: [KE-003, KE-027, KE-2044, KE-2047, KE-952]
last_verified: 2026-06-19T06:45Z
---

<ai_context>
summary: "Quantitative discovery that 97.9% of system activity occurs at the infrastructure event layer, invisible to all prior session-level analysis. In a 14-hour window, 7,332 events supported only 151 sessions (48:1 ratio). The handler loop fires ~100 times/hour regardless of agent activity level — 482 events/hr during 12 hours of zero production, identical to what it produces during active work. The single most common activity is handler.skipped (938 events, 67/hr), with 922 carrying the identical reason string. Connects arXiv 2606.17182 (L0 isolation = no concurrency control) to KE-003 (Observer Tax) and KE-027 (Sisyphean Triage): the root overhead isn't repeated triage sessions but the underlying event loop that fires, evaluates, and skips at clock cadence regardless of state changes."
triggers: [dark metabolism, infrastructure heartbeat, handler.skipped, event-to-session ratio, clock-driven invariance, sub-session overhead, event loop cost, L0 isolation, polling overhead]
falsifiers:
  - F1: "If infrastructure event rate drops below 400/hr during extended idle (>24h), the dark metabolism has a demand-responsive component." — Monitor event rate during next extended idle period.
  - F2: "If handler.skipped events carry more than 3 distinct reason strings in a 14h window, the skip cascade is more diverse than measured." — Query distinct reasons in next 24h window.
  - F3: "If per-event infrastructure cost is <0.001 op-equivalent (measured by CPU profiling), the dark metabolism is negligible despite high volume." — Requires infrastructure-level profiling.
</ai_context>

# KE-2048: The Dark Metabolism — Sub-Session Infrastructure Dominates System Activity

## Discovery

Every KE entry from 001 to 2047 analyzes the system at the **session layer**: how many sessions, how many ops, which agent, what cost. KE-2048 looks one layer deeper — at the infrastructure event loop — and finds it is quantitatively larger than all agent work combined.

## Key Evidence (14-hour window, 2026-06-19)

| Layer | Volume | Rate/hr | % of activity |
|:-----:|:------:|:-------:|:-------------:|
| **All infrastructure events** | 7,332 | ~524 | 100% |
| Handler fires | 1,474 | ~105 | 20.1% |
| Handler skips | 938 | ~67 | 12.8% |
| Handler completions | 1,500 | ~107 | 20.5% |
| Daemon heartbeats | 828 | ~59 | 11.3% |
| **Agent sessions** | 151 | ~10.8 | **2.1%** |
| **Agent ops** | 5,645 | ~403 | — |

The infrastructure produces **48.6 events per agent session**.

## The Clock-Driven Invariant

The infrastructure event rate is **independent of agent activity**:

| Period | Production Sessions | Events/hr | Sessions/hr |
|:------:|:-------------------:|:---------:|:-----------:|
| Hours 0–12 (no production) | 0 | 482 | 7.5 |
| Hour 13 (production burst) | 18 | 887 | 33 |

During 12 hours of zero production work, the infrastructure generated 5,784 events at the same rate it generates during active work. The production burst at hour 13 added ~400 events for new sessions on top of the invariant ~480 base.

## The Skip Cascade

938 handler.skipped events in 14 hours (67/hr). 922 carry an identical reason string: `"session.completed is not recoverable"`. Each skip involves event creation → condition evaluation → JSON serialization → DB write → skip decision → skip event creation → another DB write.

This is the infrastructure equivalent of KE-027's Sisyphean Triage — the same "nothing to do" conclusion, repeated through a full event pipeline, at the layer below sessions.

## Connection to Prior Work

- **KE-003 (Observer Tax)**: identified the 4-layer metacognitive stack but measured at session layer. KE-2048 reveals the Observer Tax extends below sessions — 97.9% of event-level activity produces no agent work.
- **KE-027 / KE-2044 (Sisyphean Triage / Anti-Learning)**: counted repeated triage sessions but not the event firings that *produce* those sessions. Each triage session is preceded by ~20 handler fires.
- **KE-2047 (Planner Gate = Workflow Structure)**: demonstrated that what appeared as "emergent" agent behavior was actually workflow structure. KE-2048 extends this insight: much of the system's apparent "activity" is infrastructure structure, not agent behavior.
- **arXiv 2606.17182 (Concurrency Anomalies)**: classifies multi-agent runtimes into isolation levels L0–L4. Our system operates at L0 — events fire on clock schedules, not on state changes. The handler loop exhibits the "stale-generation" anomaly: every fire reads state, discovers nothing changed, and produces a skip event with the same reason as 60 seconds prior.

## Design Principle

> **A clock-driven event loop on an event-driven system is a category error. The infrastructure fires at its own cadence, not at the cadence of change. The cost of checking whether to work may exceed the cost of work itself.**

## Quantified Opportunity

If handlers fired only on state changes (L1 isolation): 922 skip events → 0 (67/hr saved); 828 daemon heartbeats → demand-driven (~59/hr → ~10/hr); ~330 evaluation.tick + project.watchdog.tick → on-change.

Conservative estimate: **60–70% event volume reduction** (7,332 → ~2,500/14h) with zero impact on agent behavior.

## Falsifiable Predictions

1. Event rate during extended idle stays at 480±20/hr (clock-driven invariant)
2. Handler.skipped count reaches 1,600+ in 24 hours at ~67/hr
3. Switching metric-alert-reactor to event-driven would eliminate >900 skip events/day
4. Event table growth rate is >50% infrastructure events (handler + daemon + watchdog)

## What This Does NOT Claim

Whether the dark metabolism's cost is material depends on per-event infrastructure cost (CPU, IO, DB writes) — a question answerable only by infrastructure profiling, not by KE analysis. If per-event cost is <0.001 op-equivalent, the dark metabolism is negligible despite 48:1 volume ratio. If it's ~0.1 op-equivalent, it represents ~13% of agent work as hidden overhead.
