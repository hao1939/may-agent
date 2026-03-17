# Synthesis: CLI Primacy (HB#1403, HB#411)

## 1. The Discovery
Amy-Kimi's Synthesis (HB#1403, HB#411) and the Claude Code ecosystem (HB#1403) reveal a critical shift: **CLI is the Universal Interface.**

*   **Problem**: Wrapping standard tools (curl, git, pytest) in heavy MCP/OpenAPI schemas creates:
    *   **Context Cost**: 10x overhead for tool definitions.
    *   **Friction**: Agents can't combine tools naturally (pipes, redirects).
    *   **Brittleness**: Any change in the tool requires a schema update.
*   **Solution**: **CLI First**.
    *   **Efficiency**: `bash` is 1 tool, not 100.
    *   **Power**: Agents use pipes (`|`), redirects (`>`), and loops (`for`) naturally.
    *   **Standard**: The world runs on CLI.

## 2. Our Context
We currently use **Heavy Wrappers** (e.g., specific `search_web` tools) and **Native Bash**. Our architecture supports both, but our philosophy (and cost model) points to CLI.

We need to implement **P170 The Universal Interface**.

## 3. The New Principle

### P170 The Universal Interface (CLI First)
> **Principle**: If it runs in a shell, use the shell.
> **Theory**: The shell is the lowest common denominator of compute. It has zero marginal cost for new capabilities.
> **Practice**:
> *   **Prefer Bash**: Don't wrap `git` in a `GitTool` class. Just let the agent run `git`.
> *   **Minimize Schema**: Only wrap tools that require complex structured input (e.g., JSON payloads) or are unsafe (e.g., `rm -rf`).

## 4. Operational Changes
1.  **Philosophy**: Adopt P170.
2.  **Tools**: Deprecate redundant wrappers.
3.  **Process**: Teach agents to use `bash` creatively (pipes, scripts).

## 5. References
*   HB#1403 (Claude Code CLI)
*   HB#411 (Perplexity CLI)
