# Multi-Agent Memory Architecture: From 8 Strategies to Production Design

**Source**: insights-archive-20260225.md + insights-archive-kimi-2026-03-08.md
**Date**: 2026-02-25 / 2026-03-06
**Type**: Cross-post synthesis — memory architecture deep dive

---

## The Central Problem

In multi-agent systems, memory is not a feature — it's **the primary determinant of system coherence**. Without shared memory, agents become isolated consultants who each require full re-briefing on every interaction.

---

## 8-Strategy Memory Landscape (691b0b3b, ⭐1121)

The most comprehensive XHS post on agent memory compared 8 architectural approaches:

| Strategy | Mechanism | Best For |
|----------|-----------|----------|
| **Sliding Window** | Keep last N messages | Simple chatbots, low-stake conversations |
| **Summary Memory** | LLM summarizes past conversations | Long conversations where detail doesn't matter |
| **Entity Memory** | Extract and track named entities | Customer service (track user facts) |
| **Vector Store** | Embed and retrieve by similarity | Large knowledge bases, RAG patterns |
| **Knowledge Graph** | Structured entity relationships | Complex domains with entity interactions |
| **Episodic Memory** | Store entire conversation episodes | Agents that need to recall "that time when..." |
| **Procedural Memory** | Store learned procedures/skills | Self-improving agents |
| **Layered Hybrid** | Combine multiple strategies | Production systems |

**Key finding**: No single strategy is optimal. Production systems need the hybrid approach.

---

## OpenClaw Memory Architecture (Reverse-Engineered, 6990870b)

From the community's reverse-engineering efforts:

- **MEMORY.md**: Human-readable, editable by user
- **SQLite vector store**: Machine-searchable, 70/30 vector/BM25 hybrid retrieval
- **Mandatory pre-search**: System prompt requires "run memory_search before answering" — forced retrieval, not optional

**Critical design choice**: Human-readable AND machine-searchable. Most systems choose one; OpenClaw chose both, accepting the sync overhead.

---

## K老登's 5-Agent Scenario (699aacbf, ⭐1792) — The Problem in Practice

Real deployment: 5 agents working on the same project.

**Problem**: Tell Agent A something, Agent B doesn't know. User must re-brief each agent. Cost multiplies linearly with agent count.

**Root cause**: Each agent's memory is isolated by default. There's no "shared memory bus."

---

## Three-Tier Information Protocol (Recommended)

Based on cross-post synthesis:

| Tier | Scope | Examples | Update Pattern |
|------|-------|----------|----------------|
| **Global Shared** | All agents read | USER.md, design-philosophy.md, project constraints | Write-rarely, read-always |
| **Bidirectional Sync** | Specific agent pairs | Amy↔Bob task handoffs, shared investigation state | Write-on-change, read-on-need |
| **Private** | Single agent only | Working notes, draft analysis, error logs | Write-frequently, read-self-only |

---

## AutoRefine Warning (69903894, Alibaba)

The most important finding for any system accumulating knowledge:

> **Without active maintenance (score-prune-merge), skill/knowledge libraries bloat 4.5x and utilization drops 8.9x.**

Maintenance mechanisms required:
1. **Scoring**: Track which knowledge actually gets used
2. **Pruning**: Remove unused or outdated entries
3. **Merging**: Consolidate overlapping entries
4. **Steps reduced**: 72.8% improvement with maintenance vs. without

This directly applies to Amy's growing library of posts and insights.

---

## Practical Implications for This System

1. **Library maintenance is not optional** — without it, the library becomes a time bomb
2. **Cross-agent context sharing needs explicit architecture** — not just "agents can read each other's files"
3. **Forced retrieval > optional retrieval** — if context matters, make its retrieval mandatory, not agent-discretionary
4. **Dual-format (human + machine)** is worth the overhead for any long-lived knowledge base
