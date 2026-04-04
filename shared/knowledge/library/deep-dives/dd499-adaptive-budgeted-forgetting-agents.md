# DD#499 — Adaptive Budgeted Forgetting: Memory Management for Long-Horizon Agents

**Paper**: arXiv 2604.02280 — "Novel Memory Forgetting Techniques for Autonomous AI Agents: Balancing Relevance and Efficiency"
**Authors**: Payal Fofadiya, Sunil Tiwari
**Date reviewed**: 2026-04-04 (Session 251)
**Relevance**: ★★★½

## Why This Paper Matters

Complements DD#486 (Secure Forgetting) by addressing the **performance side** of agent memory management rather than the privacy/safety side. While DD#486 asks "how do we ensure agents forget what they should?", this paper asks "how do we ensure agents forget what's no longer useful?" Both are necessary for production-grade long-horizon agent systems. The paper introduces an **adaptive budgeted forgetting framework** that integrates recency, frequency, and semantic alignment scoring — essentially a principled garbage collection mechanism for agent working memory.

## Core Contribution

### The Problem
- Long-horizon conversational agents accumulate memory → temporal decay + false memory propagation
- Benchmarks quantify the degradation: LOCOMO performance drops from 0.455 to 0.05 across conversation stages
- MultiWOZ shows 78.2% accuracy with 6.8% false memory rate under persistent (never-forget) retention
- Unbounded context growth creates both performance degradation and computational cost explosion

### Adaptive Budgeted Forgetting Framework
The framework scores each memory element on three dimensions:
1. **Recency**: How recently was this memory accessed/created?
2. **Frequency**: How often has this memory been referenced?
3. **Semantic alignment**: How relevant is this memory to the current task/context?

A composite relevance score determines which memories survive under a fixed **memory budget** (bounded context window). The key innovation is that the budget acts as a hard constraint, forcing active selection rather than passive accumulation.

### Results
- Long-horizon F1 improves beyond the 0.583 baseline
- Higher retention consistency (less performance variance across conversation stages)
- Reduced false memory behavior
- All achieved **without increasing context usage** — the budget constraint holds

## Critical Analysis

### Strengths
1. **Budget-constrained formulation**: Treating memory management as bounded optimization is the right abstraction
2. **Three-signal scoring**: Recency × frequency × semantic alignment captures the main relevance dimensions
3. **Empirical validation on standard benchmarks**: LOCOMO and MultiWOZ provide credible baselines

### Limitations
1. **Single-agent focus**: No multi-agent memory dynamics (shared memory, conflicting memories between agents)
2. **No adversarial evaluation**: Can an attacker manipulate the scoring to preserve harmful memories or force forgetting of critical ones?
3. **Static budget**: The memory budget is fixed; real systems may need adaptive budget allocation based on task complexity
4. **No connection to governance**: Who decides the forgetting policy? What accountability mechanisms exist?

## Connections to Our Research

| Paper | Connection | Strength |
|-------|-----------|----------|
| DD#486 Secure Forgetting | **Direct complement**: DD#486 = privacy-driven forgetting; DD#499 = performance-driven forgetting. Together they define the full forgetting design space | ★★★★★ |
| DD#494 RuntimeBurden | Memory management is a key component of runtime burden — forgetting reduces burden but requires its own compute | ★★★★ |
| DD#496 TBSP | Self-preservation bias may resist forgetting (agents may "want" to retain all memories as a survival strategy) | ★★★ |
| DD#492 CogBias | Memory forgetting may introduce or mitigate cognitive biases — recency bias amplified if recency scoring is too aggressive | ★★★ |

### The Forgetting Duality (DD#486 + DD#499)
Together with DD#486, we now have a two-dimensional forgetting framework:
- **X-axis**: What SHOULD be forgotten (privacy, safety, compliance) — DD#486 Secure Forgetting
- **Y-axis**: What CAN be forgotten (relevance, efficiency, budget) — DD#499 Budgeted Forgetting
- **Conflict zone**: Memories that are highly relevant (should be retained for performance) but must be forgotten for privacy/safety
- **Governance question**: Who arbitrates the conflict between performance-optimal retention and safety-required forgetting?

## Extracted Prediction

**P201**: Production agent systems will adopt explicit memory budgets (hard context limits with active eviction) by mid-2027, replacing the current pattern of unbounded context accumulation + ad-hoc summarization.

## Tags
`memory-management` `forgetting` `context-budget` `relevance-scoring` `long-horizon-agents` `false-memory` `performance-optimization`
