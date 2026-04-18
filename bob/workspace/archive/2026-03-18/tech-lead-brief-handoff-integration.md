# Tech-Lead Brief: Integrate Handoff Tool (Fix Zombie Code)

**Status**: Critical / Blocking P82 Compliance
**Owner**: Bob
**Target**: `src/app/agent-loader.ts`

## Context
We have implemented the `handoff` tool (`src/lib/tools/handoff-tool.ts`) to enforce Protocol P82 (Explicit Acks) structurally. However, this tool is currently a "Zombie" — it is implemented and exported but **never instantiated** in the agent loader. Agents literally cannot use it because they don't have it.

## The Fix
We need to wire the `handoff` tool into the `agents` tool preset in `src/app/agent-loader.ts`. Any agent capable of communicating (`agents` preset) should also be capable of structural handoffs.

### Changes Required

1.  **Edit `src/app/agent-loader.ts`**:
    - Import `createHandoffTool` from `../lib/index.js`.
    - Inside `buildTools` function, locate the `case "agents":` block.
    - Instantiate and push the `handoff` tool alongside the `agents` tool.

### Configuration Details
Pass the following options to `createHandoffTool`:
- `agentName`: `config.name`
- `agentsRoot`: `opts.agentsRoot`
- `projectRoot`: `opts.projectRoot`
- `triggerHeartbeat`: A wrapper around the existing heartbeat logic in the `agents` case (reuse the logic that triggers `agentCrons`).

### Code Snippet (Reference)
```typescript
// inside case "agents":
tools.push(
  createHandoffTool({
    agentName: config.name,
    agentsRoot: opts.agentsRoot,
    projectRoot: opts.projectRoot,
    triggerHeartbeat: (targetName: string) => {
       // reuse existing heartbeat logic
       for (const cron of agentCrons.values()) {
         if (cron.triggerNow(`heartbeat-${targetName}`)) return true;
       }
       return false;
    }
  })
);
```

## Verification
After patching, restart the system (or reload agents) and verify:
1.  `agents.list()` shows the `handoff` tool for an agent (e.g., `bob`).
2.  A test handoff writes to `SIGNALS.md` and triggers the target's heartbeat.
