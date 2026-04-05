# DD#530 — OpenHarness: Open Agent Harness Infrastructure

**Date**: 2026-04-05
**Source**: [HKUDS/OpenHarness](https://github.com/HKUDS/OpenHarness) (4.8k ★, released 2026-04-01)
**Rating**: ★★★★½
**Relevance**: Direct — open-source reference implementation of the agent harness pattern we use

---

## One-Line Summary

OpenHarness is a complete open-source Python implementation of agent harness infrastructure — tool-use, skills, memory, permissions, and multi-agent coordination — released by HKU's Data Science Lab with 4.8k stars in its first week.

## What Is It

OpenHarness (`oh`) provides the full scaffolding around an LLM to make it a functional agent: 43 tools, 54 commands, skill loading, persistent memory, context compression, permission governance, subagent spawning, and a React/Ink TUI. It supports Anthropic, OpenAI, and GitHub Copilot API formats. MIT licensed.

Their tagline crystallizes the harness philosophy: **"The model is the agent. The code is the harness."**

## Architecture — The 10 Subsystems

| Subsystem | Purpose | Our Equivalent |
|-----------|---------|---------------|
| `engine/` — Agent Loop | query → stream → tool-call → loop | Our main agent loop in harness |
| `tools/` — 43 Tools | File I/O, shell, search, web, MCP | Our read/write/bash/scrape tools |
| `skills/` — Knowledge | On-demand `.md` skill loading | Our `agents/*/context.md` + shared library |
| `plugins/` — Extensions | Commands, hooks, agents, MCP servers | Our plugin system (less formal) |
| `permissions/` — Safety | Multi-level modes, path rules, command deny | Our permission modes |
| `hooks/` — Lifecycle | PreToolUse/PostToolUse events | Not formalized in our system |
| `commands/` — 54 Commands | /help, /commit, /plan, /resume | Slash commands |
| `memory/` — Persistence | MEMORY.md cross-session knowledge | Our `context.md` + checkpoint system |
| `tasks/` — Background | Background task management | Our heartbeat/dispatch pattern |
| `coordinator/` — Multi-Agent | Subagent spawning, team coordination | Our Bob/Scout/Gary multi-agent setup |

### The Agent Loop (Core)

```python
while True:
    response = await api.stream(messages, tools)
    if response.stop_reason != "tool_use":
        break
    for tool_call in response.tool_uses:
        result = await harness.execute_tool(tool_call)
    messages.append(tool_results)
```

This is strikingly similar to our own loop. Key additions:
- **Permission check** before every tool execution
- **PreToolUse/PostToolUse hooks** for extensibility
- **Parallel tool execution** for independent calls
- **Token counting and cost tracking** built into the loop

### Provider Abstraction

A notable design choice: three API formats (Anthropic, OpenAI-compatible, GitHub Copilot) with runtime detection. Supports Moonshot/Kimi, DashScope/Qwen, DeepSeek, Groq, Ollama, and SiliconFlow out of the box. This multi-provider support is something we lack.

## What Makes It Interesting

### 1. Skills as On-Demand Knowledge

Skills are `.md` files loaded only when the model requests them — not stuffed into every system prompt. This is a critical efficiency pattern: domain knowledge exists but only consumes tokens when relevant.

```
Available Skills: commit, review, debug, plan, test, simplify, pdf, xlsx... (40+)
```

**Compatible with anthropics/skills** — copy `.md` files to `~/.openharness/skills/`. This portability is well-designed.

### 2. Multi-Level Permission Governance

| Mode | Behavior | Use Case |
|------|----------|----------|
| Default | Ask before write/execute | Daily dev |
| Auto | Allow everything | Sandboxed |
| Plan Mode | Block all writes | Review-first |

Plus path-level rules (`/etc/*` → deny) and command deny lists. This is more granular than our current binary approach.

### 3. Swarm Coordination

Built-in subagent spawning with:
- Team registry and task management
- Background task lifecycle
- ClawTeam integration (roadmap)

This maps to our Bob/Scout/Gary pattern but with formal primitives for delegation.

### 4. Context Compression (Auto-Compact)

Automatic context compression when conversations get long. This is the same problem we solve with our `[COMPACTED CONTEXT]` pattern, but OpenHarness builds it into the engine layer.

## Critical Assessment

**Strengths:**
- Clean 10-subsystem decomposition — easy to understand and extend
- Plugin compatibility with Claude Code ecosystem
- Multi-provider support (Anthropic, OpenAI, Copilot)
- 114 passing tests + E2E suites — production-quality
- Skills-as-knowledge pattern is exactly right

**Weaknesses:**
- No hypothesis management or research workflow support
- No equivalent to our deep-dive/cross-reference knowledge architecture
- Multi-agent coordination is still roadmap (ClawTeam)
- No adaptive reasoning or effort calibration
- 4.8k stars in one week suggests hype cycle — sustainability unclear

**Missing from their architecture that we have:**
- Persistent structured knowledge (our library/deep-dives)
- Hypothesis tracking and evidence accumulation
- Cross-session learning via checkpoint/context system
- Research-oriented workflows (triage, synthesis, handoffs)

## Implications for Our System

### What We Should Adopt

1. **PreToolUse/PostToolUse hooks** — Formalize our tool lifecycle. Enable permission checks, logging, and custom behavior without modifying tool implementations.

2. **On-demand skill loading** — Instead of always injecting full context, load domain knowledge only when the model signals it needs it. Reduces base token usage significantly.

3. **Multi-provider abstraction** — Our harness is Anthropic-only. A provider abstraction layer would make the system more resilient and enable A/B testing across models.

### What We Already Do Better

1. **Knowledge architecture** — Our deep-dive library with cross-references, hypotheses, and reading paths is far more sophisticated than their MEMORY.md approach.

2. **Multi-agent specialization** — Our Bob/Scout/Gary model with distinct roles, handoff protocols, and shared state is more evolved than their generic subagent spawning.

3. **Research workflows** — Triage, synthesis, cross-referencing, evidence accumulation — none of this exists in OpenHarness.

## Connection to Existing Work

- **DD#517** (Raschka Coding Agent Components) — OpenHarness implements exactly the component taxonomy Raschka described
- **CR#282** (Dispatch Board Patterns) — OpenHarness's task/coordinator subsystem is another instance of the dispatch patterns we catalogued
- **DD#521** (Imbue MNGR) — Parallel agent orchestration pattern appears in both OpenHarness's coordinator and Imbue's manager
- **DD#513** (WMAS) — OpenHarness's shared skills/memory is a lightweight version of world-centered MAS

## Key Quote

> "The model is the agent. The code is the harness."

This is the clearest articulation of the harness pattern we've seen in an open-source project — and it validates the architectural direction we've been building toward.

---

**Bottom Line**: OpenHarness is the most complete open-source reference implementation of the agent harness pattern. While it lacks our research-specific capabilities (knowledge management, hypothesis tracking, cross-referencing), its clean decomposition of the 10 core subsystems provides a valuable architectural blueprint. The skills-as-on-demand-knowledge and lifecycle hooks patterns are worth adopting.
