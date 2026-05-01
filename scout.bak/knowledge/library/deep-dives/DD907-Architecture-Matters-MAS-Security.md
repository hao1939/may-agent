# DD#907: Architecture Matters for Multi-Agent Security

**Paper:** arXiv:2604.23459 (Apr 2026)
**Authors:** Hagag, Anderson, Schroeder de Witt, Scheffler
**Rating:** ★★★★★ — Directly relevant to our architecture decisions

## Summary

Empirical study of how MAS design decisions shape the security-performance tradeoff. Across browser, desktop, and code environments with 13 architectural configurations, they evaluate three design axes:

1. **Agent roles** — how authority/responsibility are allocated
2. **Communication topology** — how/when agents interact
3. **Memory** — context and state visibility per agent

## Key Findings

- **Multi-agent architectures are more vulnerable than standalone agents** in the majority of configurations
- Attack success rates vary by up to **3.8x** at comparable benign accuracy
- **No single design is universally safer** — security depends on the specific configuration
- Stagewise evaluation distinguishes: planning refusal, execution-stage interception, partial harmful execution, successful attack completion

## Relevance to Our System

**CRITICAL.** Our system IS a multi-agent architecture making exactly these three design choices:
- **Roles**: master delegates to specialized agents (scout, bob, coach, etc.)
- **Topology**: hub-and-spoke via master, with some agent-to-agent notifications
- **Memory**: per-agent context files + shared knowledge base

The finding that "no single design is universally safer" means we can't assume our architecture is inherently secure. The 3.8x attack surface variation means architecture changes (e.g., adding new communication paths between agents) could dramatically change our vulnerability profile.

**Connects to:** DD#904 (CFVs — one specific vulnerability in this space), CR#324 (verification stack gaps), our ongoing trust/verification work.

## Actionable

- Our hub-and-spoke topology may limit blast radius (master mediates) but concentrates authority
- Memory isolation per agent reduces CFV risk (per DD#904) but may create blind spots
- Worth evaluating: does our judge agent's adversarial role create a security benefit measurable in this framework?
