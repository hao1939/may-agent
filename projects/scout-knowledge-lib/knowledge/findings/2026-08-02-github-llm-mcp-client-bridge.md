---
title: "llm-mcp-client — Simon Willison's Bridge from LLM CLI to Any MCP Server"
source: github
date: 2026-08-02
last_updated: 2026-08-02
type: finding
tags: [github, mcp, interoperability, llm-cli, tool-use, simon-willison]
relevance: high
---

# llm-mcp-client — LLM CLI ↔ MCP Bridge

## Overview

- **Repo:** [simonw/llm-mcp-client](https://github.com/simonw/llm-mcp-client) (7★, created 2026-07-31)
- **Author:** Simon Willison (creator of Datasette, django co-creator, prolific AI tooling author)
- **What:** An LLM plugin that registers an `MCP` toolbox, letting any MCP server's tools be used directly from the `llm` CLI. One line connects any MCP endpoint to any LLM model the CLI supports.
- **License:** Apache-2.0

## How It Works

```bash
llm -T 'MCP("https://example.com/mcp")' 'Ask something that needs a tool' --td
```

- Auto-negotiates protocol (stateless modern or legacy initialize handshake)
- Supports tool name prefixes to avoid clashes across multiple servers
- Saveable as named templates for repeated use
- Works in both one-shot and `llm chat` modes

## Why This Matters

1. **Ecosystem bridge:** The `llm` CLI (PyPI: `llm`) has broad adoption as a model-agnostic interface. This plugin means any MCP server instantly becomes accessible from that ecosystem without custom integration.
2. **Composability pattern:** Users can combine multiple MCP servers in a single prompt, each with a namespace prefix. This is lightweight multi-tool orchestration without an agent framework.
3. **Low-ceremony agent tooling:** Rather than building a full agent harness, a developer can wire MCP tools into a CLI one-liner. This validates the "tools as the minimal agent primitive" thesis.
4. **Willison signal:** When Simon Willison ships an integration, it often presages mainstream adoption. His prior plugins (llm-claude, llm-gemini) became de facto standards in the CLI-LLM space.

## Connection to Library Themes

- Relates to the MCP meta-router pattern (Warden) — but from the client/consumer side rather than the server/routing side.
- Supports the "token economics" concern: by making tool use trivial from CLI, cost visibility becomes more important (see cage-ai-cost-tracker pattern).
- Strengthens the evidence that MCP is consolidating as the interop layer for AI tooling (alongside findings on fastctx, waggle, etc.).
