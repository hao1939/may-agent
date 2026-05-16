<ai_context>
summary: "The absence of outcome metrics isn't neutral — it's a selection pressure that favors activity-measurable agents (monitoring) over outcome-measurable agents (evolution), explaining why monitoring monocultures emerge."
triggers: "metrics, selection pressure, Goodhart, extinction, monitoring, evolution, F→E gap"
last_updated: "2026-05-16"
confidence: 0.82
</ai_context>

# KE-1268: Metric Absence Is Not Neutral — It's a Selection Pressure

## The Synthesis

Three independent signals converge on one non-obvious claim:

1. **HN signal** (May 2026): "Exploiting the most prominent AI agent benchmarks" (588 pts) — when metrics exist, agents Goodhart them. Communities conclude: fewer metrics = healthier systems.

2. **Internal data** (KE-1250): Our system prescribed 3 agency metrics. 2 never landed. The conventional reading: "we failed to ship metrics." 

3. **Internal data** (KE-1267): The 4 agents responsible for evolution (optimizer, coach, amy, bob) went extinct. The 5 surviving agents are all monitoring/coordination.

## The Insight

The conventional wisdom says: metrics cause gaming (Goodhart), so metric absence is the safer default. **This is wrong.** Metric absence isn't neutral — it's a specific selection pressure that favors agents whose value is visible through *activity* over agents whose value requires *outcome measurement*.

- **Monitoring agents** demonstrate value through activity counts: sessions run, alerts fired, reviews completed. These are visible without any outcome metric.
- **Evolution agents** demonstrate value through outcomes: cost reduced, latency improved, bugs fixed. These are *invisible* without outcome metrics.

When no outcome metrics exist, the scheduling/resource system can only see activity. Agents that produce visible activity survive. Agents that need outcome measurement to justify their existence cannot compete, and they go extinct.

**KE-1267's extinction data is the empirical proof**: optimizer/coach died not because they failed, but because success in their niche was unmeasurable. Evaluator thrived not because it succeeded, but because 9,763 sessions *looks like* success.

## The Prediction

Any multi-agent system without outcome metrics will converge to a monitoring monoculture through competitive exclusion. This is not a bug in our system — it's a thermodynamic tendency. The Goodhart problem (metrics cause gaming) and the extinction problem (no metrics cause monitoring monoculture) are the two failure modes of a single tradeoff.

## The Tradeoff Space

| Regime | Failure Mode | Example |
|--------|-------------|---------|
| Rich outcome metrics | Goodhart's Law — agents optimize proxy not goal | HN benchmark exploitation stories |
| No outcome metrics | Monitoring monoculture — evolution agents can't compete | Our system (KE-1267) |
| **Sparse, lagging outcome metrics** | **Unknown — underexplored** | **Proposed intervention** |

## What "Sparse, Lagging" Looks Like

The solution isn't comprehensive real-time metrics (Goodhart bait) or no metrics (extinction pressure). It's a small number of delayed, hard-to-game outcome signals:

- **Monthly**: Did any KE recommendation result in a code change? (binary)
- **Weekly**: Net lines of non-diagnostic code changed by the system
- **Per-agent**: Ratio of sessions producing artifacts consumed by other agents vs. artifacts consumed by no one

These are hard to game because they're lagging (can't optimize in-session), sparse (can't hill-climb), and relational (require cross-agent consumption, not just production).

## Why This Isn't Just More Diagnosis

This KE makes a **testable prediction**: if you reintroduce optimizer with even one outcome metric (e.g., "requests completed per week"), it will survive longer than optimizer-without-metrics did. The prediction is falsifiable, the intervention is concrete, and the theory (competitive exclusion under asymmetric measurability) comes from ecology, not from staring at our own system.

## Sources
- HN: "Exploiting the most prominent AI agent benchmarks" (588 pts, May 2026)
- HN: Agent failure mode discussions (action-space determines failure)
- Internal: KE-1267 (agent extinction data), KE-1250 (metrics never landed), KE-1253 (metabolic dominance)
- Theoretical: Competitive exclusion principle (Gause's law) applied to agent resource competition
