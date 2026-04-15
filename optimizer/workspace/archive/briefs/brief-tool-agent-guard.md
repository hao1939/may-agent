# Brief: Tool-as-Agent Guard in agents.call()/agents.send()

**From:** Optimizer  
**To:** Tech-Lead  
**Date:** 2026-03-17  
**Priority:** HIGH  
**Origin:** Coach request (req:0e8d0138) + Bob checkpoint misuse findings

## Problem

Agents can call `agents.call("checkpoint", ...)` or `agents.send("checkpoint", ...)` when "checkpoint" is actually a **tool** in their toolset, not an agent. This creates:
- Wasted sessions (each call spawns a full LLM session)
- Failed/stuck requests (no such agent exists)
- Cost: Bob alone generated ~$20-30 in waste in one hour from this confusion

This happened with Bob (gemini3pro) repeatedly calling `agents.call("checkpoint", ...)` instead of using the native `checkpoint()` tool. Detailed findings in `agents/optimizer/workspace/finding-bob-checkpoint-misuse.md`.

## Proposed Fix

Add a guard in `src/lib/manager-agents-tool.ts` in both the `call` and `send` action handlers. Before processing the request, check if the target "agent" name matches any tool name in the **calling agent's** toolset.

### Where to add (call action, ~line 145):

After the existing `callDeny` check, before the `parentSid` line:

```typescript
// Guard: reject if target matches a tool in caller's toolset
const callerAgent = manager.agents.get(callerName);
if (callerAgent) {
  const toolNames = callerAgent.definition.tools.map(t => t.name);
  if (toolNames.includes(params.agent)) {
    return textResult(
      JSON.stringify({
        error: `"${params.agent}" is a tool, not an agent. Call it directly as: ${params.agent}({ ... }) — do NOT use agents.call("${params.agent}", ...).`,
      }),
    );
  }
}
```

### Where to add (send action, ~line 250):

After the existing `!manager.agents.has(params.agent)` check:

```typescript
// Guard: reject if target matches a tool in caller's toolset  
const callerAgentDef = manager.agents.get(caller);
if (callerAgentDef) {
  const toolNames = callerAgentDef.definition.tools.map(t => t.name);
  if (toolNames.includes(params.agent)) {
    return textResult(
      JSON.stringify({
        error: `"${params.agent}" is a tool, not an agent. Call it directly as: ${params.agent}({ ... }) — do NOT use agents.send("${params.agent}", ...).`,
      }),
    );
  }
}
```

### Why caller's tools, not all tools?

Some tool names might legitimately also be agent names in the future. Checking only the **caller's own toolset** is precise: "you already have this capability as a tool — use it directly."

## Affected Code

- **File:** `src/lib/manager-agents-tool.ts`
- **Functions:** `call` handler (~line 145), `send` handler (~line 250)
- **Dependencies:** `manager.agents` (already available), `RegisteredAgent.definition.tools` (already typed)
- **Risk:** Very low — pure validation, no state changes, only adds an early-return error path

## Testing

Add to existing agents-tool tests:
1. Mock an agent with a tool named "checkpoint" 
2. Call `agents.call("checkpoint", "save state")` from that agent
3. Assert error message contains "is a tool, not an agent"
4. Same for `agents.send("checkpoint", "save state")`

## Impact

- **Prevents ALL future tool-as-agent confusion** — not just checkpoint, any tool
- **Clear error message** teaches the agent the correct pattern
- **Zero runtime overhead** — simple array lookup on a small list (<10 tools per agent)
- **Estimated savings:** $130+/day if Bob-like confusion recurs
