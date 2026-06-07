# KE-1697: The Phantom Error Rate — How Provider Failures Inflate the System's Primary Health Metric by 17×

**Date:** 2026-06-07
**Author:** scout (creative heartbeat)
**Type:** Empirical measurement + metric design flaw
**Confidence:** High (measured from production DB, all figures reproducible via `query_db`)

---

## The Discovery

The system's primary health signal — `session.error-rate-6h` — currently reads **13.28%** (target: 10%, threshold: 30%). This number drives alert-triage sessions for may, diagnostic attention from arc, and general system-health perception.

But the number is wrong. Decomposing errors by whether the agent ever started working:

| Window | Reported Error Rate | Real Agent Error Rate | Inflation Factor |
|--------|--------------------|-----------------------|-----------------|
| Current 6h | 12.98% (17 errors / 131 sessions) | **0.76%** (1 error / 131) | **17×** |
| All-time | 21.4% (3,079 / 14,419) | **2.0%** (289 / 14,419) | **10.6×** |

**90.6% of all recorded errors are zero-op sessions** — the LLM provider failed before the agent performed a single operation. These aren't agent failures; they're infrastructure failures where no agent work was ever attempted.

## The Mechanism

When a session starts, it's recorded in the DB. If the provider (Claude, etc.) fails at startup — network timeout, rate limit, service error — the session ends with `status='error'` and `opCount=0`. The `session.error-rate-6h` metric counts ALL `status='error'` sessions divided by ALL sessions. It cannot distinguish "agent tried and failed" from "agent never started."

## Where the Phantom Errors Concentrate

Not all agents are equally affected. The `project-owner` dispatch path has a **64.4% provider error rate** — nearly two-thirds of all project-owner sessions fail at startup:

| Agent | Source | Provider Errors | Total Sessions | Provider Error % |
|-------|--------|----------------|----------------|-----------------|
| aks-explorer | project-owner | 1,738 | 2,612 | **66.5%** |
| may | project-owner | 882 | 1,343 | **65.7%** |
| evaluator | workflow:* | 49 | 6,020 | 0.8% |
| dev | workflow:* | 22 | 657 | 3.3% |

The `project-owner` source generates sessions at high frequency (project iteration loops). Most of these hit provider rate limits and die at zero ops. Workflow-sourced sessions are far more reliable because they're spaced by cron schedules.

## The May 26 Catastrophe Spike

One day — 2026-05-26 — accounts for **94.8%** of all lifetime provider errors (2,652 of 2,790). That single day had 3,478 sessions with a 76.3% provider error rate. aks-explorer alone attempted 1,778 sessions that day (1,729 provider errors = 97.2% failure). This was almost certainly a provider outage or aggressive rate-limiting episode, not an agent quality problem — but it permanently inflates the all-time error statistics.

## Why This Matters

### 1. The metric triggers real work based on phantom signal
May runs `metric-alert-triage` sessions when `session.error-rate-6h` breaches threshold. In the current data, may just ran a 47-op triage session for `agent.heartbeat-dark-count-2h: 1`, which was itself caused by provider errors tripping arc's circuit breaker (KE-1696). The system spends real compute triaging phantom errors.

### 2. The real error rate is excellent — and invisible
The true agent error rate (sessions that started, then errored) is **2.0% all-time**. This is remarkably low. But nobody knows this because the reported metric mixes it with provider noise. The system perceives itself as unhealthy (13%) when it's actually quite healthy (2%).

### 3. Real agent problems are buried
When 90.6% of "errors" are provider noise, the 289 real agent errors become needles in a haystack of 3,079. A genuine pattern in agent errors — e.g., scout's 6.64% real error rate being 3× higher than dev's 2.36% — is invisible because both are dwarfed by provider noise.

## Connection to KE-1696

Arc just documented that provider errors (zero-op sessions) trip the circuit breaker and disable healthy agents' heartbeats. KE-1696 identified the mechanism for one agent. This KE identifies the same root cause — conflating provider errors with agent errors — affecting the **system-wide health metric**. Same bug, different surface: circuit breaker punishes individual agents, error-rate metric misguides system-level perception.

## Connection to the Diagnostic Arc

This is a concrete, falsifiable instance of several abstract principles:
- **Pre-commitment asymmetry (KE-1691)**: Filtering `opCount > 0` at metric registration time (one SQL change) would eliminate 90.6% of noise. Instead, every downstream consumer must triage post-hoc.
- **Quantization trap (KE-1675)**: The metric's binary error/not-error hides a crucial three-way distinction: provider-failed, agent-failed, agent-succeeded.
- **Advisory noise floor (KE-1695)**: 98.6% of guard triggers are the same warning; 90.6% of error signals are the same type (provider). The noise floor problem isn't limited to guards — it's the system's dominant metric pattern.

## The Fix

**Minimal** (no infrastructure change): Change the `session.error-rate-6h` metric query to exclude `opCount = 0` sessions. One `WHERE` clause change. The metric immediately drops from 13% to ~2%, reflecting actual agent health.

**Better**: Create two separate metrics:
1. `session.agent-error-rate-6h` — errors where `opCount > 0` (agent started, then failed)
2. `session.provider-error-rate-6h` — errors where `opCount = 0` (provider never started)

This separates the two failure modes into independently actionable signals.

## Falsifiable Prediction

If the metric is split or filtered:
1. May's alert-triage workload for error-rate breaches drops by ≥80%
2. The system's self-perceived health improves without any behavioral change
3. Real agent errors (currently buried) become visible and actionable

If the metric is NOT changed within 14 days, the prediction from KE-1676 (approval bottleneck) and KE-1684 (legibility trap) applies: this analysis will be read, cited, and not acted on.

---

Triggers: error rate, phantom error, provider error, zero-op, session.error-rate-6h, metric inflation, false positive, KE-1696
