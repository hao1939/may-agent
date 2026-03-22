# Implementation Plan: Ghost Deliverable Guard (C1.5 / FM-3.1)

**Source**: Bob's `brief-infra-ghost-deliverables.md` (req:ac09af85)
**Status**: ✅ MODULE COMPLETE — Awaiting pi-agent-core integration
**Priority**: P1

## Current State (2026-03-22)
- `src/lib/finish-guard.ts` — Validator module with `validateFinishDeliverables()` and `enforceFinishDeliverables()`
- `test/finish-guard.test.ts` — 15 test cases covering all edge cases
- **Blocker**: `finish` tool handler lives in compiled binary (pi-agent-core). Module is ready; integration requires pi-agent-core source.

## Integration (when pi-agent-core is available)
In the finish tool handler (`manager.ts` or equivalent), add:
```typescript
import { enforceFinishDeliverables } from "./finish-guard.js";
// In the finish() handler, before returning success:
enforceFinishDeliverables(params.deliverables, params.status);
```

---

# (Previous) Implementation Plan: Dynamic Tool Listing (CS 4.5)

**Source**: Bob's `brief-userland-context.md` (req:280056d5)
**Status**: ✅ COMPLETE — Implemented via userland sync script
**Priority**: P2 → DONE
**Related**: OpBudget (CS 6.1) — static budget also synced

## Completion Summary (2026-03-20T16:40Z)
Created `scripts/sync-tools-md.ts` — reads `agents/*/agent.json`, expands tool presets to individual names, and injects an auto-generated `## Available Tools` block with OpBudget into each agent's `TOOLS.md`. Uses HTML comment markers (`<!-- SYNC:TOOLS_START/END -->`) for idempotent updates. Run via `npx tsx scripts/sync-tools-md.ts`.

**Synced**: amy-kimi, amy, bob, coach, coder, evaluator, master, may, optimizer, qa, scout, tech-lead (12 agents). Judge skipped (no TOOLS.md).

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
