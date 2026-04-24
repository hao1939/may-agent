# Design Brief: Common Sense Infra — Auto-Inject Tool Names

**Status**: PROPOSED
**Owner**: Tech-Lead (Implementation)
**Architect**: Bob

## Context
Common Sense item 4.5 states: "Know your tools. Use the exact tools available to you."
Currently, agents rely on `agents/shared/TOOLS.md` or their system prompt to know what tools they have. These sources can become stale (e.g., `finish()` added, `handoff()` modified) or hallucinatory (agent thinks it has `search` when it only has `grep`).
When an agent calls a non-existent tool, the system returns a `Tool not found` error, wasting a turn and opBudget.

## Problem
- **Staleness**: `TOOLS.md` is static documentation. If code changes, docs lag.
- **Hallucination**: Agents guess tool names based on training data, not reality.
- **Efficiency**: Failing a tool call just to learn it doesn't exist is wasteful (Common Sense 6.1).

## Solution
Inject the **authoritative list of available tool names** into the agent's context at runtime.
This makes the "available tools" knowledge dynamic and strictly accurate.

## Mechanism
1.  **Source of Truth**: The `toolDefinitions` array in `src/lib/tools/index.ts` (or wherever tools are registered).
2.  **Injection Point**: `agents/shared/common-sense.md` (or the system prompt construction in `manager.ts`).
3.  **Format**: A simple list or compact JSON of tool names + signatures.
4.  **Timing**: On session start (manager.ts `run` or `input`).

## Implementation Specs
1.  **Modify `src/lib/manager.ts`**:
    -   In `getSystemPrompt` or `prepareContext`:
    -   Generate a dynamic string: `## Available Tools (Runtime Verified)\n- tool_name(arg1, arg2): description\n...`
    -   Append this to the system instructions or insert it into a `{{TOOLS}}` placeholder.
2.  **Format**: Keep it concise to save tokens.
    -   `read(path): Read file content.`
    -   `write(path, content): Write file.`
    -   `agents.call(agent, task): Run agent.`
3.  **Safety**: Filter out any internal/hidden tools if they exist (though we prefer transparency).

## Expected Behavior
- Agent starts session.
- System prompt contains: "You have access to: read, write, edit, bash, handoff, finish, agents."
- Agent uses `finish()` correctly even if `TOOLS.md` is outdated.
- Agent does *not* try to use `search()` because it's not in the list.

## Success Criteria
- **Zero "Tool not found" errors** in `ops-receipts.jsonl` for standard tools.
- **Reduced Hallucination**: Agents don't invent tools.
- **Maintenance**: No manual `TOOLS.md` updates needed for tool existence (only for deep documentation).

## Action
- Tech-Lead to implement dynamic tool injection in `manager.ts`.
