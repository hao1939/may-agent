---
title: "causal-memory — Decision→Outcome Memory Layer for AI Agents"
source: github
date: 2026-08-03
last_updated: 2026-08-03
tags: [agent-memory, mcp, causal-reasoning, rust, decision-tracking]
relevance: medium
---

# causal-memory — Decision→Outcome Memory Layer for AI Agents

Repo: https://github.com/JingxuanC/causal-memory

## Summary

An MCP server that records causal decision→outcome relationships for AI agents. Unlike flat memory stores, it preserves the link between what an agent decided and what happened as a result, surviving context compaction.

## Key Details

- **Language**: Rust
- **Stars**: 7 (created 2026-07-26)
- **Approach**: Structures agent memory as causal chains rather than flat key-value or episodic logs. Designed to persist through compaction cycles where raw context is lost.

## Relevance to AI Agents

Addresses a fundamental problem in long-running agents: when context windows compact, the reasoning behind past decisions is lost. By explicitly linking decisions to observed outcomes, agents can learn from experience without needing full conversation history. This is a step toward durable agent learning that goes beyond simple RAG-style retrieval.

## Signals

- Agent memory is evolving from "store everything" to structured, causally-linked records
- MCP continues to be the preferred delivery mechanism for agent infrastructure
- Focus on surviving compaction reflects real-world long-session agent challenges
