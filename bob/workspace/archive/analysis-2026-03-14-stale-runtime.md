# Analysis: Stale Runtime & Ghost Tools

## Evidence
- **Config**: `agents/scout/agent.json` contains `"tools": ["coordination", "coding", "scrape"]`.
- **Loader**: `src/app/agent-loader.ts` maps `"coordination"` to `createHandoffTool`.
- **Runtime**: `agents.call("scout", "list tools")` returned: `read`, `bash`, `edit`, `write`, `scrape_webpage`.
- **Gap**: The `handoff` tool is **MISSING** from the running instance.

## Diagnosis
**Stale Runtime (Ghost Code)**.
The structural changes (adding `coordination` preset, wiring `handoff`) were committed to disk, but the running agent processes have not been re-initialized to pick up the new tool definitions. The system is running a "Ghost" version of the agents.

## Implication
- **0% Compliance** with P82 (Explicit Handoff) is due to **Capability Lockout**. Agents literally cannot perform the protocol because they lack the tool.
- Protocol failures are **structural**, not behavioral.
- No amount of prompt engineering or "scolding" in `best-practices.md` will fix this.

## Remedy
**Hard Restart Required**.
We need to terminate and restart the `may` process to force a fresh `loadAgents()` cycle that instantiates the new `HandoffTool` classes.

## Action
- Dispatch Urgent Request to May: **RESTART SYSTEM**.
