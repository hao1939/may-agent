# Tech-Lead Brief: Wire Handoff Tool

## Context
The `handoff` tool (P82 enforcement) has been implemented in `src/lib/tools/handoff-tool.ts` but is **not wired up** in `src/app/agent-loader.ts`. This means no agent can actually use it, explaining the "0% organic adoption" failure.

## Task
Update `src/app/agent-loader.ts` to expose the `handoff` tool.

## Implementation Details
1. **Import**: `createHandoffTool` from `../lib/index.js`.
2. **Location**: Add it to the `agents` tool preset (case "agents"). This ensures any agent capable of coordination (Bob, May, Coach, etc.) gets the handoff capability.
3. **Configuration**:
   ```typescript
   tools.push(
     createHandoffTool({
       agentName: config.name,
       agentsRoot: opts.agentsRoot,
       projectRoot: opts.projectRoot,
       // triggerHeartbeat is optional, but good to link to the cron logic if possible.
       // For now, simple instantiation is enough.
       triggerHeartbeat: (target) => {
          // Re-use the logic from the agents tool if possible, or pass the same lambda
          for (const cron of agentCrons.values()) {
            if (cron.triggerNow(`heartbeat-${target}`)) return true;
            if (cron.triggerNow("heartbeat") && target === "may") return true;
          }
          return false;
       }
     })
   );
   ```
4. **Validation**: Ensure `handoff` appears in the tool list for agents with the `agents` preset.

## Definition of Done
- `handoff` tool is available to agents.
- `verify_agent` or manual test confirms usage writes to `SIGNALS.md`.
