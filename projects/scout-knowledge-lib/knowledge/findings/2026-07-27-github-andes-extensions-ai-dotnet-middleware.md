# Andes.Extensions.AI: Composable .NET Agent Middleware

Date: 2026-07-27
Source: GitHub
Repo: https://github.com/Andes-Software-Solutions/Andes.Extensions.AI

## Summary

A set of composable Microsoft.Extensions.AI `IChatClient` middlewares for .NET that add tool-call tracking with in-band streaming progress, per-tool token usage reports, and satellite packages for MCP tools and Microsoft Agent Framework agents-as-tools.

## Key Design Patterns

- **Middleware composition**: Each concern (tool tracking, token metering, MCP bridging) is a separate middleware that chains via the standard `IChatClient` pipeline — no monolithic framework.
- **In-band streaming progress**: Tool-call status is streamed back to the caller within the existing chat response stream, avoiding out-of-band notification complexity.
- **Per-tool token accounting**: Token usage is broken down by which tool triggered the LLM call, enabling fine-grained cost attribution.
- **Agents-as-tools**: Microsoft Agent Framework agents can be exposed as tools to other agents via a satellite package, enabling hierarchical multi-agent composition.
- **MCP bridge**: Model Context Protocol tools are surfaced as native .NET tools through a dedicated middleware.

## Relevance

Demonstrates how the .NET ecosystem is converging on composable middleware patterns (similar to ASP.NET middleware) for agent infrastructure. The agents-as-tools pattern and per-tool cost attribution are production-relevant signals for enterprise agent deployments.

## Status

5 stars, created 2026-07-21. Niche but architecturally clean approach to agent middleware in .NET.
