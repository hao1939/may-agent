# EXP-216: Results

**Status**: BLOCKED — runtime integration required
**Updated**: 2026-04-24 (tech-lead heartbeat)

## Phase 1: Complete

Bob's audit (`bob/workspace/EXP-216-phase1-audit.md`) confirmed:
- `EditGuard` class exists at `src/lib/edit-guard.ts` — correct logic, clean API
- `beforeToolCall` hook exists in the runtime (`pi-agent-core`)
- **No agent session currently uses `beforeToolCall`** — the hook is available but unwired
- Path normalization is the main implementation risk

## Phase 2: BLOCKED

**Blocker**: The `beforeToolCall` wiring happens inside the `may-agent-bin` binary (compiled runtime). The guards in `src/lib/` are library code — they export functions but nothing imports them. The integration point (`composeGuards`, `wrapToolsWithReceipts`, session config) is in the runtime source, not in this repository.

All three guards in `src/lib/` are dead code for the same reason:
- `edit-guard.ts` — 0 imports
- `finish-guard.ts` — 0 imports  
- `path-guard.ts` — 0 imports

**To unblock**: The runtime binary needs to be updated to:
1. Import these guards from `agents/src/lib/`
2. Compose them into a `beforeToolCall` chain per agent config
3. Optionally: add a `guards` field to `agent.json` to configure per-agent

This requires a change to the may-agent runtime source (Hao's domain).

## Tech-lead Review (2026-08-01)

Confirmed the blocker independently:
- `may-agent-bin` is a compiled ELF binary (~100MB). Cannot modify.
- `ctx.manager.run()` / `ctx.manager.callAgent()` route through the binary — no way to inject `beforeToolCall` from userland for heartbeat/cron sessions.
- The only place `new Agent()` is called in editable code is `agents/may/handlers/project.ts` (project workflow sub-sessions only — narrow coverage).
- All three guards in `agents/src/lib/` remain dead code (only imported by `compliance-check.ts` self-test).

### Viable alternative: tool-wrapper approach

Instead of the `beforeToolCall` hook, we could wrap the `edit` tool definition itself to check a session-level read-set. The tool definitions are created by `createCodingTools()` — if that function is in editable code, we can intercept there. This avoids the runtime binary entirely.

**Action**: Investigate `createCodingTools` source location. If editable, implement guard as a tool wrapper.

## Followups

- ~~Escalate to Hao: runtime needs guard composition wiring~~ (binary is compiled, not actionable)
- **Investigate tool-wrapper approach**: wrap `edit` tool's execute function to enforce read-before-edit
- Find where `createCodingTools` is defined — if it's in the npm package, this is also blocked
