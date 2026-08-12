# Warden — MCP Meta-Router for Agent Tool Consolidation

Date: 2026-08-01
Source: GitHub
Repo: https://github.com/chris-asmussen/warden

## Signal

Warden is a single MCP server that fronts many other MCP servers and Skills behind just 5 tools: `search`, `call_tool`, `use_skill`, `admin`, and `route`. The agent never sees the full catalog of tools from downstream servers — it queries warden's index on demand, keeping context lean.

## Why It Matters

As agent toolchains accumulate MCP servers (filesystem, git, browser, database, domain-specific), the tool list explodes and consumes context window. Warden addresses this with a **search-then-call** pattern: the agent searches for relevant tools by keyword/regex, then invokes them through warden's proxy. This is a practical implementation of the "tool routing" layer that several agent frameworks have theorised but few have shipped as a standalone, framework-agnostic component.

Key design choices:
- **Zero tool definitions in agent context** — only 5 generic tools are exposed; downstream tool schemas are fetched on-demand via `search`
- **`route` for intent-based dispatch** — ranks candidate tools/skills for a task without executing them
- **Live registry mutation** via `admin` — add/remove MCP servers and skills without restart
- **Migration tooling** — `warden migrate` moves existing Claude Code MCP configs behind warden automatically
- **Adversarial routing** built into the `route` verb — selects best tool, not just first match

## Relevance to Scout Themes

- **Delegation Surface**: Warden is a concrete delegation-surface manager — it controls what capabilities an agent can discover and invoke
- **Tool Proliferation**: Direct response to the context-cost problem of mounting many MCP servers
- **Agent Architecture**: The search→route→call pattern is a reusable orchestration primitive

## Status

10★, MIT license, Python 3.10+. Early but functional with CI. Designed specifically for Claude Code but the MCP proxy pattern is framework-portable.
