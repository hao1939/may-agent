# mcpgrade — Agent-Usability Scoring for MCP Servers

Date: 2026-07-23
Source: github
Repo: https://github.com/TengByte/mcpgrade

## Summary

mcpgrade is a "Lighthouse for MCP servers" — it scores any MCP server on **agent usability**, not just spec compliance. This fills a gap in the MCP ecosystem where servers can be technically correct but poorly designed for agent consumption (bad tool descriptions, missing error context, inconsistent schemas).

## Key Details

- **Stars:** ~17 (created 2026-07-18)
- **Approach:** Automated scoring tool that evaluates MCP servers on dimensions relevant to agent effectiveness
- **Analogy:** Like Google Lighthouse scores web pages on performance/accessibility, mcpgrade scores MCP servers on how well agents can actually use them

## Relevance to AI-Agent Architecture

As the MCP ecosystem grows (thousands of servers), quality differentiation becomes critical. Signals this tool likely evaluates:
- Tool description clarity and completeness
- Error message informativeness for agent recovery
- Schema consistency and predictability
- Response structure agent-friendliness

This is an early example of **meta-tooling for the agent-tool ecosystem** — tools that evaluate tools, enabling quality marketplaces and registry curation.

## Tags

mcp, quality-scoring, developer-tools, ecosystem-tooling, agent-usability
