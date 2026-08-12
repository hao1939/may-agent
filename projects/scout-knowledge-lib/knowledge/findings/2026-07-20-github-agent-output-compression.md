---
title: "secondwind — Lossless Agent Tool-Output Compression"
source: github
date: 2026-07-20
last_updated: 2026-07-20
type: finding
tags: [github, agent-efficiency, token-optimization, context-window, rust, mcp]
---

# secondwind — Lossless Agent Tool-Output Compression

## Summary

Repo: https://github.com/orchetron/secondwind (4★, created 2026-07-20)

Rust library/proxy that losslessly compresses the tool output an AI agent sends back to the model, proves every value survived the compression, and reports exact tokens removed. Can run as a proxy, library, or middleware.

## Signal

Addresses a concrete pain point: tool calls (file reads, shell output, API responses) often contain repetitive structure (whitespace, boilerplate keys, repeated headers) that wastes context window. Unlike summarization (lossy), this guarantees no information loss — critical for coding agents where a single dropped character can cause bugs.

Complements the existing context-efficiency tools in the library:
- **symbolpeek-mcp** (scan #536): reduces input tokens by retrieving only relevant symbols
- **secondwind**: reduces output tokens by compressing tool responses losslessly

Together they squeeze both directions of the context pipeline.

## Pattern

**Lossless context compression** — treating the context window as a scarce resource and applying information-theoretic compression (not summarization) to maximize useful density. Analogous to HTTP content-encoding but for LLM token budgets.

## Relevance to Agent Architecture

| Layer | Tool | Direction |
|-------|------|-----------|
| Input optimization | symbolpeek-mcp | Minimize what goes in |
| Output optimization | secondwind | Minimize what comes back |
| Memory optimization | engRAM | Persist without bloating context |

This "token budget engineering" stack is emerging as a distinct concern separate from prompt engineering.
