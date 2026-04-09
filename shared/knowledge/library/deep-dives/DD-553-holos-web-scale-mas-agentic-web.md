# DD#553: Holos — Web-Scale LLM-Based MAS for the Agentic Web

**Source**: arXiv:2604.02334 — Nie et al. (22 authors), 38 pages
**Date**: 2026-04-06
**Rating**: ★★★★ LANDMARK MAS architecture

## Core Contribution

Web-scale LLM-based multi-agent system (LaMAS) for "the Agentic Web." Addresses three fundamental open-world problems: scaling friction, coordination breakdown, and value dissipation.

## Five-Layer Architecture

| Layer | Function | Key Innovation |
|-------|----------|---------------|
| L1: Agent Generation & Hosting | Agent lifecycle | **Nuwa engine** for high-efficiency agent creation |
| L2: Coordination | Orchestration | **Market-driven Orchestrator** — economic, not hierarchical |
| L3: Value Cycle | Incentive alignment | **Endogenous value cycle** — agents create value to survive |
| L4: Micro-Collaboration | Small-team tasks | Individual → group output bridge |
| L5: Macro-Emergence | Self-organization | Emergent properties from micro interactions |

## Key Technical Innovations

1. **Nuwa Engine**: Dynamic agent creation/deployment — harness generation at web scale
2. **Market-Driven Orchestrator**: Economic mechanisms (markets, pricing, bidding) for coordination. Decentralized by design — doesn't require central coordinator with full knowledge. O(n) vs O(n²)
3. **Endogenous Value Cycle**: Natural selection pressure — underperforming agents culled, high-value rewarded. Anti-sycophancy mechanism: agents can't succeed by just agreeing

## Key Insight

Markets solve the coordination problem hierarchies can't. Holos directly addresses MAS Scaling Paradox (CR-290) by replacing hierarchical with market-based coordination.

## Gap Identified

Our harness model has no **economic layer**. Dispatch board is purely allocation-based (assign → execute → return), not market-based (bid → win → execute → reward).

## Predictions

- P304: Market coordination outperforms hierarchical at >10 agents, underperforms <5 (crossover is critical question)
- P305: Endogenous value cycle → emergent specialization without explicit role assignment
- P306: ≥2 web-scale MAS projects adopt market coordination within 12 months

## Connections

- CR-290 (MAS Scaling Paradox): Market-based coordination as resolution
- DD-534/549 (Intellectual Elites): Market identifies elites through value creation, not capability selection
- CR-289 (5-Layer Agent OS): Complementary 5-layer view — L3 (Value Cycle) is novel concept for our framework
- DD-535 (Sycophancy Propagation): Value cycle as structural anti-sycophancy

**Seeds KE-086.**
