# Audit: agent-loader.ts Error Handling Fragility

**File:** `src/app/agent-loader.ts` (490 lines)  
**Date:** 2026-04-14  
**Auditor:** Scout (Lens D)

## Executive Summary

The agent-loader has **reasonably defensive** error handling at the top level — `loadAgents()` validates configs before registering, and `reloadAgents()` wraps everything in try-catch. However, there are several **silent failure modes** where bad state propagates downstream without the caller knowing, and a few **unguarded crash paths** in tool construction.

---

## Exported Functions

| Function | Purpose |
|---|---|
| `loadAgents(opts)` | Scan agents/, validate, register with SubagentManager |
| `reloadAgents(opts)` | Wrapper around loadAgents, catches top-level errors |
| `loadAgentHandlers(opts)` | Register JS handlers for cron entries |
| `validateAgentConfig(config, models, agentsRoot)` | Pure validation, returns error array |
| `getAgentSessionId(name)` / `setAgentSessionId(name, sid)` | Session ID tracking |
| `runAgentCleanup(agentName)` | Best-effort cleanup functions |
| `getAgentCrons()` | Access cron instances map |

---

## Failure Mode Analysis

### 1. `loadAgentConfig(agentDir, bus, agentsRoot)` — internal

| Failure Mode | Behavior | Classification | Blast Radius |
|---|---|---|---|
| **agent.json missing** | Returns `null` | SILENT | Caller (`loadAgents`) skips this dir — agent simply doesn't load. No warning logged. |
| **agent.json has invalid JSON** | Catches parse error, emits bus info event, returns `null` | LOGGED | Agent skipped. Info event goes to bus but isn't an error — could be missed in noisy logs. |
| **`extends` references nonexistent archetype** | Emits bus warning, returns un-merged config | **PARTIAL-SILENT** | **Agent loads with INCOMPLETE config** — missing parent fields (tools, context_files, domain). Validation may catch some missing fields but not all. If parent provided tools that child expected, agent runs with fewer tools than expected. |
| **Circular `extends` chain** | Infinite recursion → stack overflow crash | **THROWS (unguarded)** | **Process crash**. No cycle detection. Mitigated only because `loadAgentConfig` passes `undefined` for agentsRoot on recursive call, blocking chaining to depth 1. But a direct self-reference (`"extends": "."`) would cause agent.json → agent.json loop if the dir resolves to itself. Actually safe because passing no agentsRoot skips the extends logic on recursion. Depth is capped at 1 by design. |

### 2. `validateAgentConfig(config, models, agentsRoot)` — exported

| Failure Mode | Behavior | Classification | Blast Radius |
|---|---|---|---|
| **Missing required field (name/description/domain/model/tools)** | Error added to array | REPORTED | Caller decides — `loadAgents` skips the agent. |
| **Unknown model key** | Error added to array | REPORTED | Agent skipped. |
| **Unknown tool preset** | Error added to array | REPORTED | Agent skipped. |
| **tools is not an array** | Error added to array | REPORTED | Agent skipped. |
| **`extends` archetype dir missing** | Error added to array | REPORTED | Agent skipped. |
| **Config has extra/unexpected fields** | No validation — silently ignored | SILENT | No issue currently, but future schema changes could cause confusion. |
| **`memoryLimit` is negative or non-numeric** | No validation | SILENT | Passes to manager. Manager uses it in `getRecentDigests()` — negative value could cause unexpected behavior or empty history. |
| **`delegateDeny` is malformed** | No validation | SILENT | Passed through to agents tool. If `delegateDeny.agents` isn't an array, tool construction may throw at runtime. |

### 3. `loadAgents(opts)` — exported, main entry

| Failure Mode | Behavior | Classification | Blast Radius |
|---|---|---|---|
| **agentsRoot directory doesn't exist** | `readdirSync` throws | **THROWS** | Process crashes on startup. Not caught. `reloadAgents` wrapper would catch it. |
| **Agent name collision (two dirs → same `name` in agent.json)** | Second registration silently overwrites first via `manager.register()` → `this.agents.set(def.name, ...)` | **SILENT** | **Last-write-wins**. First agent's tools, config, description all lost. No warning. `isUpdate` check uses `manager.hasAgent()` which returns true for the overwrite, so it goes into `updated[]` — but caller sees "updated" not "collision". |
| **Model key valid at validation but `models[config.model]` is undefined** | Validation passes (model key exists), model object assigned | REPORTED (by validation) | If model key is in `models` map but value is somehow undefined/null, it's passed to `manager.register()` as `model: undefined`. Manager's `resolveSystemPrompt` and session creation would fail later when trying to use the model. |
| **`buildTools()` throws during tool construction** | **Unhandled** — async error propagates up | **THROWS** | `loadAgents` is async but doesn't try-catch individual agents' `buildTools()`. One broken agent's tool setup (e.g., a local tool file that throws on import) crashes the entire loading process. All agents after the broken one don't get loaded. `reloadAgents` wrapper catches the top-level error but returns `added: [], updated: []` — agents loaded before the crash ARE registered but not reported. |
| **Validation errors across agents** | Collected, emitted as bus info | LOGGED | Agents with errors are skipped. Remaining agents load fine. |

### 4. `buildTools(config, opts)` — internal

| Failure Mode | Behavior | Classification | Blast Radius |
|---|---|---|---|
| **Unknown tool preset string** | Bus info message, preset skipped | LOGGED | Agent loads with fewer tools. Not an error — by design. |
| **`cron.json` missing when `cron` preset is used** | `Cron.load()` checks `existsSync` → returns empty entries array | SILENT | Cron is created but has no jobs. No warning. |
| **`cron.json` is invalid JSON** | `Cron.load()` catches, calls `onError` callback → bus log | LOGGED | Cron has no entries. Agent still loads. |
| **Workflow dir doesn't exist** | `createWorkflowTool()` gets nonexistent path | SILENT | Workflow tool is created pointing to a missing dir. Runtime calls to list/run workflows will find nothing or error. |
| **`agentSessionIds.get(config.name)` returns undefined at runtime** | Several closures throw `new Error("No active ${config.name} session")` | **THROWS (at runtime)** | Workflow and cron tools throw when session ID is needed but agent has no active session. Callers must handle. |
| **Local tool file in `tools/` doesn't export a function** | Bus info message, skipped | LOGGED | Tool not loaded, agent continues. |
| **Local tool file throws on import** | Caught, bus info message, skipped | LOGGED | Tool not loaded, agent continues. Good error isolation. |

### 5. `loadAgentHandlers(opts)` — exported

| Failure Mode | Behavior | Classification | Blast Radius |
|---|---|---|---|
| **Handler .js/.ts file doesn't exist** | Error added to array, bus warning | LOGGED | Cron entry runs without handler — falls back to message-based invocation. |
| **Handler file doesn't export `create()`** | Error added to array, bus warning | LOGGED | Same as above — entry has no handler. |
| **Handler file throws on import** | Caught, error added to array | LOGGED | Entry has no handler. |
| **Handler's `create()` returns non-function at runtime** | Hot-reload wrapper throws at invocation time | **THROWS (at runtime)** | Cron job fails. Error propagates to cron tick handler. |
| **Handler file deleted between startup validation and runtime execution** | Hot-reload re-imports at each invocation; import fails | **THROWS (at runtime)** | Cron job fails on that tick. |

### 6. `reloadAgents(opts)` — exported

| Failure Mode | Behavior | Classification | Blast Radius |
|---|---|---|---|
| **Any error from loadAgents** | Caught, returned as `errors: [msg]` | CAUGHT | Graceful. But `added: [], updated: []` is misleading — agents loaded before the crash ARE registered in the manager but not reflected in the return value. |

---

## Top Risks (Ranked)

### P0: `buildTools()` crash kills entire agent loading
**Location:** `loadAgents()` line ~381 (`await buildTools(config, opts)`)  
**Problem:** No try-catch around individual agent tool building. One broken agent (bad local tool, bad import) prevents all subsequent agents from loading.  
**Fix:** Wrap `buildTools()` in try-catch per agent, skip broken agent, add to errors.

### P1: Name collision silently overwrites agents  
**Location:** `loadAgents()` iterates dirs, calls `manager.register()` which does `this.agents.set(def.name, ...)`  
**Problem:** If two agent directories have agent.json with `"name": "bob"`, the second silently wins. No duplicate detection.  
**Fix:** Build a name→dir map first, detect collisions, reject duplicates.

### P2: Missing archetype falls through with partial config
**Location:** `loadAgentConfig()` archetype resolution  
**Problem:** When `extends` archetype can't be loaded, the function emits a warning but returns the child config as-is (without parent fields). The child may be missing `tools`, `domain`, etc. that it expected to inherit. Validation catches missing required fields but NOT missing tool presets that would have come from the parent.  
**Fix:** Return `null` when archetype load fails (consistent with "can't load config" semantics).

### P3: `reloadAgents` return value lies after partial crash
**Location:** `reloadAgents()` catch block  
**Problem:** Returns `{ added: [], updated: [], errors: [msg] }` — but agents loaded before the crash ARE registered. Caller sees "nothing loaded" when in fact some agents did load.  
**Fix:** Track progress incrementally and return partial results in the catch block.

### P4: No validation on optional config fields
**Location:** `validateAgentConfig()`  
**Problem:** `memoryLimit`, `delegateDeny`, `compaction`, `context_files` are not validated. Negative `memoryLimit`, non-array `delegateDeny.agents`, non-string `context_files` entries all pass through.  
**Fix:** Add type/range checks for optional fields.

---

## System Prompt Assembly (manager.ts `resolveSystemPrompt`)

The system prompt assembly in `manager.ts` is **gracefully defensive**:

| Convention File | If Missing | Behavior |
|---|---|---|
| `SOUL.md` | Section omitted | SILENT — agent runs with no identity section |
| `common-sense.md` | Section omitted | SILENT — agent has no shared behavioral rules |
| `standing-orders.md` | Section omitted | SILENT — no standing orders |
| `knowledge-essentials.md` | Section omitted | SILENT — no shared knowledge |
| `skills/*.md` | Section omitted | SILENT — no skills loaded |
| `context.md` (context learning) | Section omitted | SILENT — no persistent context |
| `context_files` entries | `existsSync` check → skipped | SILENT — missing file silently ignored |

All file loads use `existsSync` before `readFileSync`, so missing files never throw. The risk is purely operational: an agent may run without critical context files and the operator has no indication.

---

## Summary

The loader is **moderately robust** — it validates configs before registration, catches most parse errors, and isolates local tool loading failures. The main gaps are:

1. **No per-agent isolation during tool building** (one crash kills all)
2. **Silent name collisions** (last-write-wins with no warning)
3. **Partial config on archetype failure** (should fail hard, not fall through)
4. **Misleading return values from reloadAgents on partial failure**
5. **No validation of optional config fields**

The system prompt assembly is clean — all convention files are gracefully optional. The `context_files` silently-skipped pattern is acceptable since these files are genuinely optional enrichment.
