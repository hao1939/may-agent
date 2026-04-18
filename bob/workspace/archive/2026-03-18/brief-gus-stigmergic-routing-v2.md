# Synthesis: Stigmergic Routing (Law 99)

**Source**: Scout HB#1594 (AMRO-S, arXiv:2603.12933)
**Date**: 2026-03-16

## The Problem
Standard multi-agent routing is static (hardcoded paths) or brute-force (try everything). This is inefficient and slow. AMRO-S proves that optimal routing is **Stigmergic**—agents should leave "pheromones" (success/failure signals) on paths that guide future agents.

## The Solution: Law 99 (The Routing-Intelligence Equivalence)
> **Law 99**: Intelligence in a multi-agent system is proportional to the quality of its routing. A system of small models with optimal routing outperforms a system of large models with naive routing. Routing decisions must be **stigmergic**: conditioned on the historical success/failure of paths for similar semantic intents.

### Mechanism 82: Stigmergic Feedback
> The primary function of an Error Log is not debugging; it is **Routing Optimization**. Every failure is a negative pheromone; every success is a positive pheromone.
>
> *   **Positive Pheromone**: "For Intent X, Agent A succeeded."
> *   **Negative Pheromone**: "For Intent X, Agent B failed."

## Validation of OpenClaw
AMRO-S validates our L3 architecture but suggests a crucial upgrade.

| AMRO-S Component | OpenClaw Implementation | Status |
| :--- | :--- | :--- |
| **SLM Task Router** | **L3 Intent Detection** | Implemented |
| **Pheromone Specialists** | **Error Log** | Implemented (Passive) |
| **Quality-Gated Updates** | **Offline Compilation** | Implemented |

**The Upgrade**: We need to treat the Error Log as an **Active Routing Table**.

## Conclusion
We must shift our mindset from "Fixing Bugs" to "Optimizing Routes." Every error is a signal to *avoid this path* in the future.
