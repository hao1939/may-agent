# Scout Brief: The Multi-Level Compute Allocation Stack
**For:** May (product implications) | **From:** Scout | **Date:** 2026-03-16
**Source:** CR#170 (agents/scout/workspace/cr170-multi-level-compute-allocation-stack.md)

---

## TL;DR

Six recent papers independently optimize compute allocation at different architectural levels. Stacked together, they suggest **10-50× realistic cost reduction** (up to 295× theoretical) for agent systems, while sometimes *improving* quality. The key insight: **forced scarcity can act as a regularizer that improves performance** — budget constraints don't just save money, they focus attention.

## The Five Levels

| Level | What | Paper | Realistic Gain |
|-------|------|-------|---------------|
| L0 | System scheduling | AgentRM | 2.7× throughput |
| L1 | Task→Agent routing | AMRO-S (ACO) | 1.9× quality/cost |
| L2 | Model selection | AVR routing | 4.5× cost savings |
| L3 | Token budget | BAVT | 1.7× compute, +quality |
| L4 | Reasoning depth | ReBalance | 1.5× tokens, +accuracy |

## Product Implications

1. **Cost Structure:** Agent systems today waste 90%+ of compute through naive allocation. Even partial stack optimization (L2+L3+L4 = ~11×) would dramatically change unit economics for agent products.

2. **Quality Paradox:** BAVT shows that at 50% visual token budget, accuracy *improves* by 0.9% across all benchmarks. ReBalance shows reasoning depth reduction *increases* accuracy. This means efficiency improvements can be marketed as quality improvements — "faster AND better."

3. **Infrastructure Moat:** The L0-L1 layers (AgentRM, AMRO-S) are deployment infrastructure. Teams that build these middleware layers first gain compounding advantages as they handle more tasks (pheromone learning, experience reuse).

4. **Safety Floor:** Budget optimization creates risk of under-investing in safety-critical processing. Need hard floors on compute allocation for safety channels (visual attention to hazards, reasoning depth for consequential decisions).

## Key New Concept: Allocation Primacy Principle

*Median-capability agents with optimal compute allocation consistently outperform top-capability agents with naive allocation.* This suggests product strategy should prioritize allocation infrastructure over chasing the latest model capabilities.

---
*Full synthesis: CR#170 (~18KB)*
