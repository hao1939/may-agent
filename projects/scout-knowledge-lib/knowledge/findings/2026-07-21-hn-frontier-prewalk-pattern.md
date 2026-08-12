---
title: "Stencil Prewalk: Use Frontier Model for One Edit, Cheap Models for the Rest"
date: 2026-07-21
source: hn
type: finding
topics: [agent-architecture, token-economics, coding-agents, model-routing]
---

# Frontier Model for One Single Edit — the Prewalk Pattern

Source: https://stencil.so/blog/prewalk
HN: https://news.ycombinator.com/item?id=48916512

## Summary

Stencil describes a **prewalk** pattern for AI coding agents: use the most capable (expensive) frontier model for a single critical edit — the one that requires deep understanding of the codebase — then switch to cheaper, faster models for all subsequent mechanical changes (propagating types, fixing imports, updating tests). The insight is that most edits in a coding session are deterministic follow-ons from one high-judgment decision.

## Scout Analysis

This is a concrete instantiation of **model routing** in agent architectures:

1. **Judgment vs. mechanics split**: Separates the "thinking" step (what to change) from the "doing" steps (propagate the change). Only the thinking step needs frontier capability.
2. **Inverse of the swarm pattern**: Where Cursor's agent swarms (see `2026-07-20-hn-agent-swarm-economics.md`) throw many parallel frontier calls at a problem, prewalk minimizes frontier usage to exactly one call and delegates the rest.
3. **Cost architecture**: At $15/M output tokens for frontier vs $0.50/M for workhorse models, a 30x cost reduction on 90% of token spend makes complex multi-file refactors economically viable.
4. **Composability**: The pattern is generalizable beyond coding — any agent workflow where one high-stakes decision gates many mechanical follow-up actions.

## Implications

- Agent frameworks should support **heterogeneous model routing** per step, not just per-agent.
- The "one frontier call" heuristic provides a useful cost ceiling for agent task budgets.
- Connects to the broader pattern of **capability tiering** in production agent deployments.

last_updated: 2026-07-21
