# FastMCP: The Pythonic MCP Server & Client Framework

Date: 2026-07-21
Source: GitHub
Repo: https://github.com/PrefectHQ/fastmcp

## Summary

FastMCP is the leading Python framework for building Model Context Protocol (MCP) servers and clients. Created by Prefect (workflow orchestration company), it provides a high-level, decorator-based API for exposing tools, resources, and prompts to LLM agents via the MCP standard.

## Key Features

- **Decorator-based tool definition**: `@mcp.tool()` to expose Python functions as agent-callable tools
- **Client library**: Build MCP clients that discover and invoke tools programmatically
- **Resource & prompt support**: Full MCP spec coverage beyond just tools
- **Type-safe**: Leverages Python type hints for automatic schema generation
- **Composable**: Mount sub-servers for modular MCP service architectures

## Agent Engineering Relevance

- De facto standard for Python MCP server development
- Enables rapid prototyping of tool-use backends for AI agents
- Client library useful for building agent orchestrators that consume MCP tools
- Composability pattern relevant for multi-capability agent architectures
- Apache-2.0 license allows commercial use

## Metrics

- 26,602★, 2,165 forks
- Apache-2.0 license
- Active development (last updated 2026-07-21)
- Backed by Prefect (established open-source workflow company)
