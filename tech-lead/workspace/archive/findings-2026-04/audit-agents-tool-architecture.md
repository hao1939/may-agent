# Audit: manager-agents-tool.ts Architecture Review

**File**: `src/lib/manager-agents-tool.ts` (677 lines)  
**Date**: 2026-04-13  
**Lens**: Architecture quality — structure, duplication, abstraction fitness

---

## 1. File Structure

The file has four logical sections:

| Section | Lines | Purpose |
|---------|-------|---------|
| Imports + interface defs | 1–93 | `AgentsToolManagerDeps`, `CreateAgentsToolOptions` — dependency injection interfaces |
| Detached cancel helpers | 95–116 | Lazy-loaded socket/detached modules for cancel-over-socket |
| Schema + types | 118–192 | `AgentsToolParams` (TypeBox schema) + mirrored TS interface `AgentsToolParamsType` |
| `createAgentsTool()` | 197–675 | Factory function containing a single giant `switch` over 8 actions |

The factory function (`createAgentsTool`) is the entire public API. It returns one `AgentTool` object whose `execute` handler dispatches via `switch(params.action)`.

**Consumer**: `SubagentManager.createAgentsTool()` in `manager.ts:2465` delegates directly to this function, casting `this` to the deps interface.

---

## 2. Concern Mapping (Lines per Action)

| Action | Lines | Complexity | Notes |
|--------|-------|-----------|-------|
| `call` | ~77 | High | Sync call + request tracking + outcome update |
| `fork` | ~68 | High | Async fire-and-forget + request tracking |
| `message` | ~106 | Highest | Dedup, structured message building, tracking, heartbeat trigger, bus emit |
| `context` | ~65 | Medium | 4 sub-scopes (parent/origin/root/workflow), tree walking |
| `requests` | ~65 | Medium | 4 filter modes, direct DB queries in `failed`/`all` cases |
| `cancel` | ~39 | Medium | 3-tier: in-memory → socket → SIGTERM |
| `list` | ~16 | Low | Simple map |
| `peek` | ~17 | Low | Simple delegate |

Total switch body: ~453 lines across 8 cases. This is a **monolithic dispatcher** pattern.

---

## 3. Findings

### MEDIUM — Triplicated tool-name guard (lines 219–230, 297–308, 400–410)

The "is this a tool not an agent?" guard is copy-pasted identically across `call`, `fork`, and `message`. Each copy:
1. Gets caller agent name
2. Looks up caller's registration
3. Gets tool names array
4. Checks if target is in the list
5. Returns a formatted error

This is **~12 lines × 3 = 36 lines** of pure duplication. Only the error message verb differs ("agents.call", "agents.fork", "agents.message").

**Recommendation**: Extract `guardToolNameCollision(manager, callerName, targetAgent, action): string | null` — returns error string if collision, null if clean.

### MEDIUM — Triplicated validation preamble (call/fork/message)

Each of call, fork, and message independently performs:
1. Agent existence check (`manager.agents.has`)
2. Call-deny check (`callDeny.agents.includes`)
3. Request tracking (`trackRequest(...)`)

The structure is identical across all three; only the method name and response shape differ. This is ~20 lines × 3 = 60 lines of structural duplication.

**Recommendation**: Extract `validateAndTrack(params, action)` that returns `{ error?: string, requestId?: string }`.

### LOW — Duplicated TypeBox schema and TypeScript interface (lines 118–192)

`AgentsToolParams` (TypeBox) and `AgentsToolParamsType` (manual TS interface) define the same shape twice. The TS interface exists because TypeBox's `Static<>` inference apparently isn't used. This creates a maintenance risk — if someone adds a param to the schema but forgets the interface (or vice versa), they silently diverge.

**Recommendation**: Use `Static<typeof AgentsToolParams>` to derive the type, or add a compile-time assertion that the two are assignable to each other.

### LOW — `requests` action contains raw SQL (lines 578–610)

The `failed` and `all` filter branches construct SQL queries inline rather than going through `requests.ts` helpers. This is inconsistent — the `active` and `stale` branches use the `getActiveRequests`/`getStaleRequests` abstractions, but `failed` and `all` bypass them.

**Recommendation**: Add `getFailedRequests()` and `getAllRequests()` to `requests.ts` so the tool stays at the same abstraction level throughout.

### LOW — Swallowed errors in request tracking (8 empty catch blocks)

Every `trackRequest`/`updateRequest`/`isDuplicate` call is wrapped in try/catch with empty catch blocks and a `// Non-fatal` comment. While the intent is correct (tracking shouldn't break the tool), silent swallowing means tracking bugs are invisible. Over time this erodes confidence in the request DB.

**Recommendation**: Log at debug/warn level inside those catch blocks, or at minimum increment a counter. The `// Non-fatal` comment is not a substitute for observability.

### LOW — Detached cancel lazy-import caching (lines 95–116)

Module-level mutable variables (`_readIdentity`, `_sendSocketCommand`) cache lazy imports. This works but is a non-standard pattern — a simple `let _detachedHelpers: Promise<...> | null` with a single lazy promise would be cleaner and avoid the partial-load edge case (one import succeeds, the other throws, leaving half-cached state).

---

## 4. What's Working Well

- **Dependency injection via interface**: `AgentsToolManagerDeps` breaks the circular dependency with manager.ts cleanly. The interface is well-scoped — only the methods the tool needs.
- **Single-file encapsulation**: All 8 actions in one file means there's one place to look for agent cooperation logic. No fragmentation across files.
- **Error boundaries per action**: The outer try/catch in `execute` ensures any unhandled error returns a structured JSON error rather than crashing the agent.
- **Progressive cancel strategy**: The 3-tier cancel (in-memory → socket → SIGTERM) is well-designed for the attached/detached session model.
- **Dedup in message**: The `isDuplicate` check prevents redundant inter-agent messages, which is a practical improvement.

---

## 5. Severity Summary

| Severity | Count | Summary |
|----------|-------|---------|
| HIGH | 0 | — |
| MEDIUM | 2 | Tool-name guard 3× duplication; validation preamble 3× duplication |
| LOW | 4 | Schema/type duplication, raw SQL in requests, swallowed errors, lazy-import pattern |

---

## 6. Recommendations (Prioritized)

1. **Extract shared guards** (addresses both MEDIUMs): A `validateAgentTarget(manager, callerName, targetAgent, callDeny, action)` function that performs tool-name collision check, existence check, and deny-list check. Returns `{ error: string } | null`. This eliminates ~80 lines of duplication and makes adding a 4th action (e.g., "subscribe") trivial.

2. **Extract request tracking wrapper**: A `withRequestTracking(persistDir, caller, agent, task, method, opts, fn)` that handles the trackRequest/updateRequest/error-classification boilerplate. Each action case shrinks by ~15 lines.

3. **Derive TS type from TypeBox schema**: Replace the manual `AgentsToolParamsType` interface with `Static<typeof AgentsToolParams>`.

4. **Add `getFailedRequests`/`getAllRequests` to requests.ts**: Keep the tool at a consistent abstraction level.

5. **Add warn-level logging to catch blocks**: Replace empty catches with `logger?.warn(...)` or similar.

---

## 7. Overall Assessment

**Verdict: Adequately structured with addressable duplication.**

The file's architecture — a single factory function with switch dispatch — is a reasonable choice for a tool with 8 actions. The dependency injection pattern is clean and the file is self-contained. The main issue is ~100 lines of copy-paste duplication across `call`/`fork`/`message` that could be eliminated with 2-3 small helper functions. No HIGH severity issues. The file doesn't need a rewrite — it needs a focused DRY pass.
