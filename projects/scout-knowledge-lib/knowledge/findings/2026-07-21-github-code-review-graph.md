# code-review-graph: Local-First Code Intelligence for AI Coding Agents

Date: 2026-07-21
Source: GitHub Trending
Repo: https://github.com/tirth8205/code-review-graph

## Summary

code-review-graph (23.8k★) builds a persistent structural map of a codebase using Tree-sitter, tracks changes incrementally, and exposes precise context to AI coding tools via MCP. The goal: stop AI assistants from re-reading large chunks of a repo on every review task.

## Key Details

- **Approach**: Parses code with Tree-sitter into a structural graph, then serves only relevant context to AI tools through an MCP server
- **Platform support**: Claude Code, Cursor, Codex, Gemini CLI, Kiro, GitHub Copilot, CodeBuddy — single `install` command auto-detects and configures
- **Includes**: VS Code extension, GitHub Action for CI integration, git hooks for incremental updates
- **Benchmarked**: Claims measurable context reduction on code reviews and large-repo workflows
- **Stack**: Python (pip/pipx/uvx installable), MIT licensed

## Relevance to AI Agents

This represents an emerging pattern: **structural code graphs as MCP-served context** for coding agents. Rather than letting agents naively grep or read entire files, a pre-built graph narrows the context window to only affected symbols and their dependencies. This is directly relevant to agent efficiency (token cost, latency) and accuracy (less noise in context).

## Tags

- mcp
- coding-agents
- context-optimization
- tree-sitter
- code-review
