# Lens A: agent-loader.ts Architecture Review

**File**: `src/app/agent-loader.ts` — 854 lines  
**Date**: 2026-04-13  
**Objective**: Assess whether the 854-line size is justified, identify mixed concerns, dead code, and architectural issues.

---

## 1. Concern Inventory

The file contains **6 distinct responsibilities**:

| # | Concern | Lines | Span |
|---|---------|-------|------|
| 1 | **Type definitions** (AgentConfig, AgentLoaderOptions, ValidationError, LoadResult) | ~50 | L45-77, L475-580 |
| 2 | **Session ID tracking** (module-level Map + get/set) | ~10 | L78-86 |
| 3 | **Cleanup management** (module-level Map + add/run) | ~30 | L91-125 |
| 4 | **Tool factory** (`buildTools` — giant switch/case mapping preset strings → tools) | ~260 | L144-400 |
| 5 | **Config loading & registration** (`loadAgentConfig`, `validateAgentConfig`, `loadAgents`, `reloadAgents`, `loadLocalTools`) | ~240 | L407-665 |
| 6 | **Handler auto-discovery** (`loadAgentHandlers` + dynamic resolver) | ~170 | L683-854 |

**Assessment**: Concerns 1-3 are small and tightly coupled to the loader — splitting them would create trivially small files. Concerns 4-6 are substantial. The `buildTools` switch/case (260 lines) is the largest single block and the most likely split candidate, but it has no consumers outside this file. The handler auto-discovery (concern 6) is genuinely separate — it runs after `loadAgents()` and deals with cron handlers, not agent config. It imports 5 additional modules (`handler-context`, `cron-tool`, `requests`, `persistence`, `evaluator`) that the rest of the file doesn't need.

**Verdict**: The 854-line size is *borderline justified*. Concern 6 (`loadAgentHandlers`) is the strongest split candidate (~170 lines, separate imports, separate lifecycle). The rest is cohesive enough to stay together.

---

## 2. Duplicated Code

### Handler resolution logic duplicated (HIGH)

The pattern for resolving handler files (check `.js` then `.ts`, import, validate `create()`, wrap in hot-reload closure, register) appears **twice**:
- **Startup path**: `loadAgentHandlers()` main loop, lines 738-780
- **Dynamic resolver**: `cron.setHandlerResolver()` callback, lines 795-845

These are ~60 lines of near-identical code. The `existsSync(jsPath)` / `existsSync(tsPath)` pattern appears **4 times** total in the file (2× startup, 2× resolver).

**Recommendation**: Extract `resolveAndRegisterHandler(cron, agentName, entry, ctx, bus)` called by both paths. This was previously identified in `audit-handler-resolution-architecture.md` but never implemented.

### triggerHeartbeat closure duplicated (LOW)

The `triggerHeartbeat` callback is copy-pasted between the `"agents"` preset (L188-193) and the `"message-only"` preset (L206-211). Same 6-line closure in both places.

**Recommendation**: Extract to a shared helper.

---

## 3. Module-Level Mutable State

Three module-level `Map` singletons:

| Map | Type | Purpose |
|-----|------|---------|
| `agentSessionIds` | `Map<string, string>` | Tracks active session ID per agent |
| `agentCleanups` | `Map<string, Array<() => void>>` | Cleanup functions registered by tools |
| `agentCrons` | `Map<string, Cron>` | Cron instances created during tool building |

These are exported/consumed by `may.ts` via getter functions. The `agentCrons` map is particularly concerning — it's populated as a **side effect** of `buildTools()` (inside the `"cron"` preset case), then consumed by `loadAgentHandlers()` and `may.ts`. This temporal coupling (build tools → populate map → read map) is implicit and fragile.

**Severity**: Medium. Works in practice because the call order in `may.ts` is fixed, but refactoring `loadAgents()` could easily break it.

---

## 4. Known Issues

### 4a. Docstring/behavior mismatch (LOW)
`loadAgents()` at L586 has JSDoc: "Throws on validation errors (fail-fast prevents running with broken config)." Actual behavior: collects errors, emits warning, skips bad agents. This has been flagged by QA twice (journal entries from March 2026).

### 4b. Checkpoint tool session injection hack (LOW)
Lines 305-317: The checkpoint tool uses `_setSessionId` and `_setAgentName` properties cast via `as any`. This bypasses TypeScript's type system to inject session context at runtime. Works, but is a maintenance hazard — any refactor that changes tool identity would silently break it.

### 4c. Dead/misleading comment (TRIVIAL)
Line ~740 area: Comment says "We need the compiled .js version. If only .ts exists, that's an error." But the code immediately handles `.ts` with "Bun handles .ts imports natively." The comment predates the Bun migration.

### 4d. `validateAgentConfig` takes `agentsRoot` only for `extends` validation (TRIVIAL)
Previously flagged as "dead parameter" but it IS used for the `extends` field check (L519-526). Not actually dead — the earlier QA finding was incorrect.

---

## 5. Interaction with manager.ts and buildSessionContext()

`agent-loader.ts` calls `manager.register()` which stores the agent definition in `SubagentManager`. The loader does NOT call `buildSessionContext()` — that happens inside `manager.run()` when a session starts. The interaction is clean:

```
agent-loader.ts                    manager.ts
  loadAgentConfig()    
  validateAgentConfig()
  buildTools()         
  manager.register()  ──────────►  stores AgentDefinition
                                    (tools, model, knowledgeDir, etc.)
                      
                       [later, on session start]
                                    run() → buildSessionContext()
                                    → reads SOUL.md, DOMAIN.md, etc.
```

The boundary is well-defined. The loader handles *what* an agent is (config, tools), and the manager handles *how* it runs (prompt assembly, session lifecycle).

---

## 6. Recommended Actions

| Priority | Action | Effort |
|----------|--------|--------|
| **P2** | Extract `loadAgentHandlers()` + dynamic resolver into `src/app/handler-loader.ts` | Small (move 170 lines, update imports in may.ts) |
| **P2** | Extract shared `resolveAndRegisterHandler()` to deduplicate handler resolution | Small (extract ~40 lines, call from 2 places) |
| **P3** | Fix `loadAgents()` docstring to match actual skip-and-warn behavior | Trivial |
| **P3** | Extract `triggerHeartbeat` closure to a shared helper | Trivial |
| **P3** | Clean up stale ".js version" comment in handler loader | Trivial |
| **P4** | Consider replacing checkpoint `_setSessionId` hack with a proper factory pattern | Small but needs coordination with manager.ts |

**Overall health**: The file is functional and well-commented. The 854-line size is at the upper bound of acceptable for a single concern-area. The handler auto-discovery section (concern 6) is the clearest candidate for extraction. No dead exports or unreachable code paths were found. The main architectural weakness is the implicit temporal coupling via module-level Maps.
