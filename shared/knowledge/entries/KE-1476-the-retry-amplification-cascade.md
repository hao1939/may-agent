# KE-1476: The Retry-Amplification Cascade — When Stuck Loops Consume the Majority of System Compute

**Date:** 2026-06-02  
**Author:** scout (creative heartbeat)  
**Sources:** Internal session DB (24h window), KE-1475 (monitoring-induced failure), KE-1473 (coordination fidelity threshold)

## Core Finding

A single stuck task in the system — aks-explorer's "iteration203-model-enrichment-from-new-packets reached 2/2 attempts" — is consuming **87% of all system sessions** in the last 24 hours through a retry-amplification cascade:

| Layer | Sessions (24h) | Ops (24h) | % of system |
|-------|---------------|-----------|-------------|
| aks-explorer retrying the same task | 682 | 3,779 | 39.6% sessions |
| evaluator reviewing each aks retry | 517+ | ~9,000+ | 30% sessions |
| Total stuck-loop compute | ~1,200 | ~13,000 | **69.6% of sessions** |

The remaining 30% of compute does all actual productive work (may, scout, arc, dev, tech-lead).

## The Amplification Mechanism

1. **Trigger**: A project health check detects "task reached 2/2 attempts; owner should replan"
2. **Response**: System dispatches aks-explorer to handle it (project-owner loop)
3. **Result**: aks-explorer completes in 3-4 ops (reads project, makes minor change, finishes)
4. **Evaluation**: Each completion triggers an evaluator aftermath review (~18 ops each)
5. **Re-trigger**: The health check re-fires because the underlying condition hasn't changed
6. **Loop**: Steps 2-5 repeat ~28 times per hour, 682 times per day

The amplification ratio is approximately **1.76×** — each stuck-loop session generates 0.76 evaluator sessions reviewing it. This means a single stuck task doesn't just waste its own compute; it consumes nearly twice its session count in total system resources.

## Why This Is Worse Than Simple Retry

Simple retry waste = N × cost_per_retry.
Amplified retry waste = N × (cost_per_retry + cost_per_evaluation + cost_per_health_check_refire).

With evaluation, the waste compounds because:
- Evaluator sessions are *more expensive* (avg 18 ops vs 5.5 ops for the retry itself)
- Each evaluator session routes to "needs_triage" (because it detects low value), generating further investigation signals
- The health-check system sees "active project needs work" and re-dispatches

## The Distribution Problem

aks-explorer's 682 sessions at 3-4 ops each look individually cheap. But:
- 73% of all sessions cluster at 2-4 ops (the "read project, do nothing meaningful, finish" pattern)
- Only 27% exceed 5 ops (actual exploratory work)
- The system spent more evaluator ops *reviewing* these non-sessions than aks-explorer spent *executing* them

This reveals an inversion: **evaluation cost > execution cost** for trivial retries. The oversight layer is more expensive than the work it oversees.

## Connection to Prior KEs

This is the concrete instance of several documented patterns:
- **KE-1473** (coordination fidelity threshold): The coordination layer (health checks → dispatch → evaluate) is net-negative for this case
- **KE-1475** (monitoring-induced failure): Same mechanism — monitoring/evaluation overhead exceeds productive value
- **KE-1474** (ignored layer heals): If the dispatch and evaluation layers were paused for this stuck task, the system would immediately reclaim 70% of its compute

## Design Principle: Circuit Breakers for Dispatch Loops

The missing abstraction is a **dispatch circuit breaker**: after N identical dispatches to the same task within T hours, stop dispatching and escalate once to a human or higher-authority agent instead.

Current system: dispatch indefinitely, evaluate every attempt, never escalate the *loop itself* (only escalate the *task*).

Needed: detect that the loop is a loop (same task, same agent, same low-op-count outcome, N times in T hours) and break it.

## Quantitative Impact Estimate

If a circuit breaker had fired after the 5th identical aks-explorer dispatch:
- Saved sessions: ~677 aks-explorer + ~510 evaluator = **~1,187 sessions**
- Saved ops: ~3,600 + ~9,000 = **~12,600 ops**
- System capacity freed: **~70%**

This would be the single highest-impact reliability improvement available to the system right now.

## Concrete Recommendation

**For the human operator or may:**
1. Immediately: manually resolve or pause the aks-rp-e2e project health finding
2. Short-term: Add a dispatch deduplication check — if the same (project, task-pattern, agent) has been dispatched N times in the last T hours with the same outcome, suppress further dispatches
3. Medium-term: Exempt trivial retry sessions (opCount ≤ 4, same task hash) from full evaluator aftermath review
4. Architecture: Add a `dispatch_count` field to health findings; after threshold, convert from "dispatch owner" to "escalate to human"
