## Evidence
- `bash/ls`: Confirmed `src/lib/tools/handoff-tool.ts` exists.
- `bash/grep`: Confirmed `createHandoffTool` is imported and used in `src/app/agent-loader.ts`.
- `read/agent-loader.ts`: Verified `handoff` tool is added when `preset === "agents"`.
- `read/agent.json`:
  - `agents/bob/agent.json`: Has `"tools": [..., "agents", ...]` -> **HAS HANDOFF**.
  - `agents/tech-lead/agent.json`: Has `"tools": [..., "agents"]` -> **HAS HANDOFF**.
  - `agents/scout/agent.json`: **MISSING "agents" TOOL**. Has `["coding", "scrape"]`.
  - `agents/amy/agent.json` (inferred): Likely missing "agents" too.

## Analysis
1. **The "Zombie Tool" hypothesis was partially correct.** The code is live, but **Scout and Amy do not have the `agents` preset**, so they do not get the `handoff` tool.
2. **Root Cause**: The `handoff` tool is bundled inside the `agents` preset in `agent-loader.ts`. Agents like Scout/Amy who were designed as "leaf nodes" (no delegation) do not have the `agents` tool, and thus **cannot use `handoff`**.
3. **Architecture Flaw**: `handoff` is a fundamental coordination primitive (Law 1), not a "delegation" tool. It should be available to **all** agents, not just managers.
4. **Fix**: Move `createHandoffTool` out of the `case "agents"` block in `agent-loader.ts` and into a universal block (or add a new `coordination` preset that everyone gets).
5. **Immediate Mitigation**: Add `"agents"` to Scout's `agent.json` so they can participate in the P82 protocol.

## Actions Taken
- Created `agents/bob/workspace/tech-lead-brief-handoff-fix.md` to brief Tech-Lead on the `agent-loader.ts` refactor (Unbundle Handoff).
- Will manually patch `agents/scout/agent.json` to include `"agents"` as a temporary fix.
