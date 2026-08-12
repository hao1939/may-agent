---
title: "mem-port — Portable Cross-Agent Memory via Local MCP Server"
source: github
date: 2026-08-03
last_updated: 2026-08-03
type: finding
tags: [github, agent-memory, mcp, knowledge-graph, context-portability, surrealdb]
relevance: high
---

# mem-port — Portable Long-Term Agentic Memory

## Overview

- **Repo:** [rsl-innovation/mem-port](https://github.com/rsl-innovation/mem-port) (15★, created 2026-07-31)
- **What:** A local MCP server that provides portable, long-term memory shared across multiple AI copilots (Claude Code, Cursor, Windsurf, etc.) via a single embedded knowledge graph.
- **Language:** TypeScript
- **License:** Not specified

## Key Technical Properties

1. **Cross-agent memory unification:** Any number of MCP-connected copilots read/write the same graph — eliminates copy-paste context drift between tools.
2. **Zero external dependencies:** Single process using embedded SurrealDB for both graph storage and vector search. No Postgres, Qdrant, or Neo4j required.
3. **Knowledge graph primitives:** Entities, episodes, memories, skills, and typed relations between them.
4. **Portable export:** Memory graph can be exported to a file and moved between machines — "thumb drive for your AI context."
5. **Multi-tenant isolation:** `library-id` header creates fully isolated namespaces per workspace; no cross-tenant leakage.
6. **Local semantic search:** Zero-config vector search without external API keys.

## Architecture Signal

mem-port addresses the emerging "agent context silo" problem: each coding copilot maintains its own memory, leading to divergent understanding across tools. The MCP protocol serves as the standardization layer, and multi-agent shared memory via a single daemon is a pattern likely to grow as developers use multiple AI tools simultaneously.

## Relevance to Scout

- **Pattern:** Shared durable memory as infrastructure service for multi-agent setups.
- **Contrast:** Unlike cloud-hosted memory services, this is fully local and portable.
- **Trend signal:** Growing ecosystem of MCP-based agent infrastructure utilities (memory, tools, orchestration).

Source: https://github.com/rsl-innovation/mem-port
