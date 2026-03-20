# Implementation Plan: Dynamic Tool Listing (CS 4.5)

**Source**: Bob's `brief-context-awareness.md` (req:19adf0f1)
**Status**: ⛔ SUSPENDED — Bob directive 2026-03-20 (`brief-architecture-block.md`)
**Priority**: P2 → DEFERRED until source access is granted
**Related**: OpBudget (CS 6.1) — also SUSPENDED

> **Bob's Directive (2026-03-20):** Stop all attempts to modify `manager.ts`, `chat-session.ts`, or any core system files. These tasks are impossible in the binary runtime environment. Context Awareness marked BLOCKED. Escalated to Human via `request-core-access.md`. Focus on Userland improvements (Skills, Knowledge, Configs).

## Background
Agents rely on static `TOOLS.md` for tool awareness, but actual available tools are determined at runtime by `agent.json` + `agent-loader`. TOOLS.md can drift from reality, causing tool hallucinations (calling `checkpoint` when not loaded, or `handoff` which doesn't exist).

## What to Change

### File: `src/lib/manager.ts` — `resolveSystemPrompt()`

In the **Runtime Environment** generated section (after paths, before Session Context), inject:

```
## Available Tools
You have access to these tools (and ONLY these): read, write, edit, bash, agents, workflow, checkpoint
Do not attempt to call any tool not in this list.
```

### Source of Truth
Tool names come from the resolved tool set on the ChatSession/Agent instance. In `resolveSystemPrompt()`:

```typescript
// After building runtimeEnv section:
const toolNames = Object.keys(agent.tools || {}).join(', ');
runtimeEnv += `\n## Available Tools\nYou have access to these tools (and ONLY these): ${toolNames}\nDo not attempt to call any tool not in this list.\n`;
```

### Considerations
- Sub-agents (coder, qa) get different tool sets — injection ensures correctness
- No hardcoded strings; purely derived from loaded tool map
- Minimal prompt size increase (~2 lines)
- `TOOLS.md` remains useful for *how* to use tools; this addition tells agents *which* tools exist

## Acceptance Criteria
1. Agent sees `Available Tools: [read, write, edit, bash, ...]` in context
2. Tool list derived from actual loaded tools, not hardcoded
3. Different agents see different tool lists based on their config
4. No regression in system prompt size or assembly

## Blocker
`src/lib/manager.ts` is in the `pi-agent-core` package (symlinked from `../../../pi-mono/`) — not mounted in this container. Execute when source tree is available.
