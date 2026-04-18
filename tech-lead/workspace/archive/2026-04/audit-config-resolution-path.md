# Audit: Config Resolution Path Complexity

**Date**: 2026-04-12  
**Lens**: B (Flow Complexity)  
**Scope**: From "agent needs a session" → fully resolved config → first LLM call

## The Full Path (6 phases)

### Phase 1: Agent Registration (startup, once per agent)
**File**: `src/app/agent-loader.ts` → `manager.register()`

1. `loadAgents()` scans `agents/` for `agent.json` files
2. `loadAgentConfig()` reads JSON, handles `extends` archetype inheritance
3. `buildTools()` maps tool preset strings → actual `AgentTool[]` instances (big switch/case)
4. `loadLocalTools()` scans `agents/<name>/tools/` for custom tool files
5. `manager.register()` stores the `SubagentDefinition` in `this.agents` Map

**Layers**: 3 (config load → tool build → register)  
**Complexity**: Moderate. The `buildTools()` function is 200+ lines but it's a flat switch/case — easy to follow. Archetype inheritance (`extends`) adds one layer of recursion.

### Phase 2: Session Start — `run(name, task, opts)`
**File**: `src/lib/manager.ts:905`

1. Look up registered agent by name
2. **Hot-reload memoryLimit** from `agent.json` on disk (lines 918-925) — reads the file *again* at every `run()` call
3. Generate sessionId, create dirs, compute outputDir
4. `buildTransformContext()` → creates compaction transform if enabled
5. `createAgent()` → Phase 3

**Layers**: 2 (run setup → createAgent)  
**Issue**: The hot-reload of `memoryLimit` (step 2) reads `agent.json` from disk on EVERY session start. Only `memoryLimit` is hot-reloaded — everything else (model, tools, description) uses the cached version from startup. This is inconsistent and adds an I/O read per session for a rarely-changed field.

### Phase 3: Agent Construction — `createAgent(def, sessionId, opts)`
**File**: `src/lib/manager.ts:350`

1. Inject sessionId into checkpoint tools (mutable setter hack: `tool._setSessionId`)
2. Filter out tools with undefined parameters
3. `resolveSystemPrompt(def)` → Phase 4
4. `wrapToolsWithReceipts()` → adds receipt/signature infrastructure
5. `composeGuards()` → chains 10 guard functions as `beforeToolCall` middleware
6. Construct `new Agent({...})`

**Layers**: 2 (createAgent → resolveSystemPrompt)  
**Issue**: The checkpoint tool sessionId injection (step 1) is a mutable-closure hack. Both `_setSessionId` and `_setAgentName` are attached as ad-hoc properties in `agent-loader.ts` and consumed via `(tool as any)._setSessionId`. This is fragile — if the tool object is cloned or the property name changes, it silently fails.

### Phase 4: System Prompt Assembly — `resolveSystemPrompt(def)`
**File**: `src/lib/manager.ts:417`

Reads up to 7 sources, all via `readFileSync`:
1. `SOUL.md` — agent identity
2. `common-sense.md` — shared rules
3. `standing-orders.md` — direct orders
4. `knowledge-essentials.md` — verified findings
5. `skills/*.md` — behavioral patches (recursive dir scan)
6. Runtime Environment section (generated from def paths)
7. Available Tools section (generated from def.tools)

Wrapped in `<system_instructions>` tags.

**Layers**: 1 (flat sequence of file reads)  
**Assessment**: Clean. This is intentionally flat — no delegation, no indirection. Files are read synchronously. The decision to keep this in the system prompt (stable across sessions) vs. session context (per-session) is well-documented and correct for KV-cache.

**Note**: This is called **once per session** via `createAgent()`. Not called again during the session. Good.

### Phase 5: Session Context Assembly — `buildSessionContext(def, name, sessionId, persistDir, task)`
**File**: `src/lib/manager.ts:536`

This builds the first user message prefix (not the system prompt). Per-session volatile data:

1. Session ID + current time
2. **Digest-based history** (`getRecentDigests()` + `getCrossAgentDigests()` + `getUnresolvedDigests()`) — 3 DB queries
3. **Active Recall** (`runActiveRecall()`) — reads `ERROR_LOG.jsonl` from disk
4. **Checkpoint injection** (`readLatestCheckpointForAgent()`) — reads from disk
5. **Context files** (`def.contextFiles`) — reads N files from disk
6. **Agent context.md** — reads from disk
7. **Knowledge routing** (`routeKnowledge()`) — keyword matching against knowledge index

**Layers**: 1 (flat sequence), but **7 subsystems** each with their own I/O  
**Assessment**: This is the most complex part of the config resolution path. Each subsystem is independently useful but the aggregate is:
- 3 SQLite queries + 3-5 file reads + 1 JSONL parse per session start
- No caching — each session start repeats all I/O
- No parallelism — all reads are synchronous and sequential

### Phase 6: Prompt Construction + First LLM Call
**File**: `src/lib/manager.ts:1047-1072`

1. `buildSessionContext()` → Phase 5
2. `routeFewShotExamples()` — keyword matching for worked examples (1 more file scan)
3. Concatenate: `sessionContext + fewShotBlock + task`
4. `runAgentWithRetry(session, agent.prompt(promptText), ...)` → first LLM call

**Layers**: 1  
**Assessment**: Clean concatenation, no unnecessary indirection.

## Summary: Layer Count

| Phase | What | Layers | I/O ops |
|-------|------|--------|---------|
| 1. Registration | agent.json → tools → register | 3 | ~10 files per agent |
| 2. run() | lookup + hot-reload + dirs | 2 | 1 file read (hot-reload) |
| 3. createAgent | tools + guards + Agent() | 2 | 0 |
| 4. resolveSystemPrompt | 7 file sources → string | 1 | 5-10 file reads |
| 5. buildSessionContext | 7 subsystems → string | 1 | 3 DB queries + 3-5 files |
| 6. Prompt + LLM call | concat + prompt | 1 | 1 file scan (few-shot) |
| **Total** | | **~10** | **~20 I/O ops** |

## Findings

### Finding 1: Hot-reload inconsistency (minor)
`run()` hot-reloads `memoryLimit` from `agent.json` on every session start but nothing else. If the intent is hot-reload, it should reload all mutable fields. If the intent is "change config → restart process", the hot-reload is unnecessary overhead.

**Recommendation**: Either expand to hot-reload all fields (call `loadAgentConfig()` and update `def`), or remove the hot-reload entirely. The `reloadAgents()` API already exists for live config updates — it re-registers the agent with a full rebuild.

### Finding 2: Checkpoint tool session injection is a hack (minor)
The `_setSessionId`/`_setAgentName` mutable closure pattern in `agent-loader.ts:335-345` is fragile. It creates tools with placeholder values, then `createAgent()` mutates them by searching for the checkpoint tool by name.

**Recommendation**: Instead of mutable closures, pass sessionId/agentName via the tool factory's callback mechanism (already using `() => currentSessionId` lambdas). The mutation in `createAgent()` is actually redundant — the tool already captures the lambda reference.

### Finding 3: buildSessionContext does repeated DB/file I/O without caching (observation)
Every session start does 3 SQLite queries + 3-5 file reads + 1 JSONL parse. For rapid session starts (e.g., workflow with 5 steps), this means ~20 redundant I/O operations that could be cached for the ~1 second between workflow step starts.

**Not recommending a change** — the I/O is synchronous and fast (< 50ms total), and caching would add complexity. But worth noting if session start latency ever becomes a concern.

### Finding 4: Architecture is fundamentally sound
Despite 6 phases, the design is *intentionally layered* with clear separation:
- **System prompt** (Phase 4): stable across sessions → KV-cache friendly
- **Session context** (Phase 5): volatile per session → first user message
- **Tools** (Phase 1): built once at registration, reused across sessions

There's no unnecessary indirection. Each phase does exactly one thing. The code could be slightly cleaner (Findings 1-2) but isn't architecturally wrong.

## Verdict

**No major simplification needed.** The config resolution path is 6 phases / ~10 layers which sounds like a lot, but most phases are flat file reads without delegation. The two concrete improvements (hot-reload inconsistency, checkpoint tool hack) are minor cleanups worth doing opportunistically, not urgent refactors.

The system prompt vs. session context split is well-reasoned (KV-cache optimization documented in P147), and the buildSessionContext subsystems each earn their keep (digests, recall, checkpoints, knowledge routing all serve distinct purposes with evidence of value).
