# Manager.ts Architecture Audit

**Date**: 2026-04-11  
**File**: `src/lib/manager.ts` — 2,393 lines  
**Manager cluster** (manager.ts + satellites): 4,779 lines total  
**Class**: `SubagentManager` (single class, single export)

---

## 1. Inventory

### 1a. Method Count

| Category | Count |
|----------|-------|
| Public methods | ~40 |
| Private methods | ~17 |
| Getters | 2 |
| Constructor | 1 |
| **Total** | **~60** |

### 1b. Satellite Files (already extracted)

| File | Lines | Responsibility |
|------|-------|---------------|
| `manager-agents-tool.ts` | 677 | Creates the `agents` tool (call/fork/list/peek/cancel/requests/message/context) |
| `manager-retry.ts` | 431 | `runAgentWithRetry`, `hasFinishToolCall`, `extractFinishParams` |
| `manager-receipts.ts` | 376 | Tool output signing, receipt verification, op counting |
| `manager-utils.ts` | 307 | `generateId`, `formatDuration`, `truncateForPrompt`, shared types |
| `manager-health.ts` | 202 | `computeHealth`, `computeAuditHealth`, `computeReconcileHealth` |
| `manager-trace.ts` | 196 | `buildTrace` — session graph construction |
| `completion.ts` | 197 | `detectErrors`, `clearPostFinishErrors`, `detectShallowHeartbeat`, `determineOutcome` |

**Prior extraction pattern**: pure functions that take data args (not `this`) get pulled into standalone files. Manager methods become thin delegators. This has worked well for health, trace, retry, receipts, and completion.

### 1c. Dependencies (39 import lines)

**Core framework**: `@mariozechner/pi-agent-core` (Agent, AgentMessage, AgentEvent, AgentTool)  
**Satellite modules**: 7 manager-* files + completion.ts  
**Tool guards**: 10 guard factories imported individually (!)  
**Context injection**: 6 modules (active-recall, checkpoint, knowledge-router, fewshot-router, session-digest, handoff)  
**Persistence**: persistence.ts, requests.ts  
**Infrastructure**: compaction.ts, overflow.ts, log.ts, detached.ts  
**Node built-ins**: node:fs (6 functions), node:path (4 functions)

---

## 2. Responsibility Map

### Group A: Session Lifecycle (~800 lines, L877-L1420)
The core reason this class exists. Tightly coupled — all methods need `this.activeSessions`, `this.registry`, `this.agents`.

| Method | Lines | Role |
|--------|-------|------|
| `run()` | 877-1049 | Start a new agent session (173 lines) |
| `resumeSession()` | 1276-1420 | Resume from persisted state (145 lines) |
| `resumeStaleSessions()` | 1074-1190 | Process restart recovery (117 lines) |
| `cleanupZombieSessions()` | 1192-1274 | Periodic orphan cleanup (83 lines) |
| `handleCompletion()` + `handleCompletionInner()` | 686-833 | Session end pipeline (148 lines) |
| `cancel()` | 1777-1805 | Abort running session |
| `close()` | 1859-1933 | Archive and remove session |
| `escalateBlockedSession()` | 845-875 | Post-completion escalation |

**Verdict**: ✅ Cohesive. These all mutate the same shared state (`activeSessions`, `registry`, `agents`). Extracting these into a separate module would just create a friend class that needs full access to all internals anyway.

### Group B: Agent Construction (~200 lines, L295-L520)
Sets up Agent instances with tools, guards, compaction, and system prompts.

| Method | Lines | Role |
|--------|-------|------|
| `createAgent()` | 349-414 | Build Agent with tools + guards (66 lines) |
| `resolveSystemPrompt()` | 416-518 | Load SOUL.md + skills + generate sections (103 lines) |
| `buildTransformContext()` | 295-346 | Set up compaction transform (52 lines) |

**Verdict**: 🟡 Moderately extractable. `resolveSystemPrompt()` and `buildSessionContext()` are pure functions that take a `SubagentDefinition` and return strings. They don't need `this` except for `this._projectRoot`. Could be a standalone `prompt-builder.ts`.

### Group C: Context Assembly (~110 lines, L520-L628)
Builds the per-session user message preamble (history, recall, checkpoints, knowledge routing).

| Method | Lines | Role |
|--------|-------|------|
| `buildSessionContext()` | 520-628 | Assemble session context preamble (109 lines) |

**Verdict**: 🟡 Extractable with Group B. This is already largely delegating (calls `getRecentDigests`, `runActiveRecall`, `readLatestCheckpointForAgent`, `routeKnowledge`) — the method is essentially a template that calls into 6 other modules and concatenates strings.

### Group D: Query/Read-Only Methods (~310 lines, L1422-L1705, L2090-L2248)
Expose session state for API consumers, tools, and UI.

| Method | Lines | Role |
|--------|-------|------|
| `status()` | 1422-1442 | List all active sessions (20 lines) |
| `sessions()` | 1584-1590 | Filter sessions by agent name (7 lines) |
| `progress()` | 1592-1615 | Get session messages with pagination (24 lines) |
| `result()` | 1617-1631 | Get session result (15 lines) |
| `buildResultFromSession()` | 1633-1663 | Build TaskResult from active session (31 lines) |
| `resultFromArchive()` | 1665-1701 | Build TaskResult from persisted data (37 lines) |
| `getSessionTree()` | 1486-1582 | Build recursive session tree (97 lines) |
| `getSessionSummary()` | 2192-2220 | Get handoff summary (29 lines) |
| `getWorkflowSteps()` | 2222-2249 | Get workflow step summaries (28 lines) |
| `listAgents()`, `agentCount()`, etc. | 1449-1478 | Agent registry queries (trivial one-liners) |
| Path accessors | 2090-2133 | `getKnowledgePath`, `getWorkspacePath`, `getWorkflowDir`, `getOutputPath` (44 lines) |

**Verdict**: 🟢 These are all thin wrappers over `this.activeSessions.get()` + `this.registry`. They're individually tiny and don't clump into a meaningful separate object. The session tree builder (97 lines) is the only one with complexity.

### Group E: Interaction Methods (~120 lines, L1717-L2042)
Active session manipulation for chat and tool use.

| Method | Lines | Role |
|--------|-------|------|
| `input()` | 1717-1775 | Send user input to chat session (59 lines) |
| `steer()` | 1935-1967 | Inject mid-turn message (33 lines) |
| `followUp()` | 1969-1989 | Queue message at turn boundary (21 lines) |
| `subscribe()` | 1991-2002 | Subscribe to session events (12 lines) |
| `waitFor()` | 2004-2020 | Await session completion (17 lines) |
| `waitForIdle()` | 2022-2042 | Await chat session idle (21 lines) |
| `waitForDetached()` | 2044-2088 | Poll for detached session (45 lines) |
| `resumeInterrupted()` | 1807-1828 | Resume chat from interrupted (22 lines) |

**Verdict**: ✅ Cohesive with session lifecycle. These are the "session interaction API" and need direct access to `activeSessions`. Small individually.

### Group F: Delegation Thin-Wrappers (~120 lines, L2135-L2393)
Methods that delegate immediately to satellite modules.

| Method | Lines | Role |
|--------|-------|------|
| `health()` | 2156-2162 | → `computeHealth()` |
| `auditHealth()` | 2164-2167 | → `computeAuditHealth()` |
| `reconcileHealth()` | 2169-2173 | → `computeReconcileHealth()` |
| `trace()` | 2135-2144 | → `buildTrace()` |
| `signToolOutput()` | 2175-2177 | → `signToolOutput()` from receipts |
| `verifyToolOutput()` | 2179-2181 | → `verifyToolOutput()` from receipts |
| `createVerifyReceiptTool()` | 2183-2185 | → `createVerifyReceiptTool()` from receipts |
| `getOpUsage()` | 2187-2190 | → `getOpUsage()` from receipts |
| `callAgent()` | 2251-2352 | Depth-tracked run+waitFor (102 lines — the only non-trivial one) |
| `runAgent()` | 2368-2385 | Thin wrapper over `this.run()` |
| `createAgentsTool()` | 2387-2393 | → `createAgentsToolFn()` |

**Verdict**: ✅ These are the correct pattern — the satellite module holds the logic, the manager method is just a stable API surface. `callAgent()` is the only substantial one, and it needs `this.callDepths` + `this.run()` + `this.waitFor()`.

### Group G: Event System (~60 lines, L204-L262)
Event bus bridging and emission.

| Method | Lines | Role |
|--------|-------|------|
| `emit()` | 204-211 | Emit event on bus (8 lines) |
| `bridgeAgentEvents()` | 213-261 | Subscribe to Agent events, forward to bus (49 lines) |

**Verdict**: ✅ Cohesive. Tiny, needs `this.bus` and `this.activeSessions`.

### Group H: Infrastructure (~50 lines)
Timeout management, sentinel files, API gate, persistence subscription.

| Method | Lines | Role |
|--------|-------|------|
| `setupTimeout()` | 650-668 | Set session timeout (19 lines) |
| `clearTimeout()` | 670-674 | Clear session timeout (5 lines) |
| `removeSentinel()` | 835-843 | Delete [STARTED] file (9 lines) |
| `gatedPrompt()` | 1830-1857 | API rate-limit gate (28 lines) |
| `subscribeForPersistence()` | 276-293 | Subscribe for JSONL persistence (18 lines) |
| `cleanupSession()` | 630-637 | Post-completion cleanup (8 lines) |
| `cleanupCallDepths()` | 643-648 | Call depth map cleanup (6 lines) |
| `register()` / `unregister()` | 263-275 | Agent registration (13 lines) |

**Verdict**: ✅ All small, all need `this.*`. Not worth extracting individually.

---

## 3. Coupling Analysis

### What manager.ts imports from (39 imports)
Manager is a **hub** — it orchestrates, so it rightfully imports many modules. No circular dependencies detected.

### What imports manager.ts (8 files)
| File | What it imports | Type-only? |
|------|----------------|------------|
| `index.ts` | `SubagentManager`, `generateId`, `truncateForPrompt` | No (re-export) |
| `workflow-tool.ts` | `SubagentManager` | Type only |
| `session-digest.ts` | `SubagentManager` | Type only |
| `session-subscribers.ts` | `SubagentManager` | Type only |
| `evaluator.ts` | `SubagentManager` | Type only |
| `manager-agents-tool.ts` | via `AgentsToolManagerDeps` type | Effectively type-only |
| `tools/agent-growth.ts` | `SubagentManager` | Value import |
| `chat-session.ts` | `SubagentManager` | Type only |

**Key insight**: 6 out of 8 consumers only import the **type** `SubagentManager`. They don't depend on the implementation, just the shape. This is healthy — the class is used as a capability interface, not as a tight coupling point.

Only `index.ts` (re-export) and `agent-growth.ts` (spawns agent via manager) import the actual value.

### Hub-and-spoke is correct
Manager is the central orchestrator. Everything flows through it. This is not accidental coupling — it's inherent to the domain. A session manager that doesn't know about sessions, agents, persistence, and events wouldn't be useful.

---

## 4. Cohesion Assessment

### What holds this class together
The `activeSessions` Map is the gravity well. **38 of 60 methods** reference `this.activeSessions` either directly or indirectly. The second attractor is `this.registry` (persistence layer access), referenced by ~25 methods.

Splitting the class would require either:
1. **Passing the Maps around** → friend class pattern, no real separation
2. **Duplicating state** → consistency bugs
3. **Facade pattern** → more code, same coupling

### The extractable seam
Groups B+C (`resolveSystemPrompt` + `buildSessionContext` + `buildTransformContext`) are the most extractable. They are ~265 lines of **pure data transformation** that happens to live on the class. They only need:
- `SubagentDefinition` (input)
- `this._projectRoot` (one scalar)
- `this.registry.persistDir` (one scalar)

These could be standalone functions in a `prompt-builder.ts` module, called by `run()` and `resumeSession()`.

---

## 5. Findings

### F1: Prompt/Context Assembly is the clearest extraction candidate
**Lines**: 416-628 (213 lines)  
**What**: `resolveSystemPrompt()` and `buildSessionContext()` are pure functions wearing method disguises. They take a `SubagentDefinition`, read files from disk, and return strings. No mutation, no shared state.  
**Size**: S-M (move 2 methods + loadFile helper to `prompt-builder.ts`, update 2 call sites in manager)  
**Priority**: P2 — improves readability but doesn't fix a bug or reduce risk.

### F2: Guard imports are verbose but harmless
**Lines**: 16-31 (import section) + 380-395 (usage in createAgent)  
**What**: 10 individual guard factory imports. Feels noisy, but `composeGuards()` already handles composition. The alternative (a barrel import) would hide which guards are active.  
**Size**: S (create guards barrel export)  
**Priority**: P3 — cosmetic.

### F3: `run()` is 173 lines — at the complexity boundary
**What**: Session setup, config hot-reload, context building, few-shot injection, agent creation, persistence subscription, event emission, and `runAgentWithRetry` kickoff — all in one method.  
**Observation**: This is sequential setup code. Every step depends on the previous step's output. Extracting sub-methods wouldn't reduce complexity, just scatter it.  
**Priority**: P3 — monitor but don't act. The method is long but sequential and readable.

### F4: `handleCompletionInner()` does too many things at 115 lines
**What**: Error detection → overflow check → chat idle handling → shallow heartbeat detection → outcome classification → archival → escalation → event emission. Plus 3 async `upsertDigest()` fire-and-forget calls scattered through it.  
**Risk**: The digest calls are fire-and-forget (`.catch(err => log(...))`), which is fine, but they make the method harder to read. The chat-vs-task branching is also interleaved.  
**Size**: M (extract digest emission into a helper; already partially done via `completion.ts`)  
**Priority**: P2 — would improve readability of the most critical path.

### F5: `getSessionTree()` is 97 lines of pure tree construction
**What**: Builds a recursive `SessionTreeNode` tree for the agents tool's `list` action. Contains 4 nested helper closures (`findSession`, `mapStatus`, `extractResult`, `buildNode`).  
**Observation**: This is already a self-contained unit. It reads from `activeSessions` and `registry` but doesn't mutate anything. Could trivially live in `manager-trace.ts` alongside `buildTrace`.  
**Size**: S (move to manager-trace.ts, pass activeSessions + registry as args)  
**Priority**: P3 — minor cleanup.

### F6: Duplicate session construction between `run()` and `resumeSession()`
**What**: Both methods construct an `ActiveSession` object with ~25 fields. The field lists are almost identical but diverge in subtle ways (resume has `maxTurns: persisted.maxTurns ?? RESTORED_MAX_TURNS_FALLBACK` vs run's `maxTurns: opts?.maxTurns ?? 0`).  
**Risk**: When a new field is added to `ActiveSession`, it must be set in both places. Missing it in one causes resume-only or run-only bugs.  
**Size**: S (extract `createActiveSession(common, overrides)` factory)  
**Priority**: P2 — prevents a real class of bugs (resume/run field divergence).

---

## 6. Verdict: Well-Factored God Object

**Manager.ts is a god object — and it should be.** It's the session orchestrator. The 2,393 lines represent genuine coordination complexity, not unnecessary bloat.

The extraction pattern that's already been applied (satellites for retry, health, trace, receipts, completion, agents-tool) is correct and should continue incrementally.

### What's working well
- **Satellite delegation**: 2,189 lines already extracted to 7 satellite files
- **Type-only coupling**: 6/8 downstream consumers only use `SubagentManager` as a type
- **Clear separation of concerns**: Each satellite handles one domain (retry, health, trace, etc.)
- **Thin wrapper pattern**: Manager methods → satellite pure functions (health, trace, receipts)

### Action items (prioritized)

| ID | What | Size | Priority | Why |
|----|------|------|----------|-----|
| F6 | `createActiveSession()` factory to eliminate run/resume field divergence | S | P2 | Prevents real bugs when adding new session fields |
| F4 | Extract completion digest calls from `handleCompletionInner()` | M | P2 | Readability of most critical path |
| F1 | Extract prompt/context assembly to `prompt-builder.ts` | S-M | P2 | 213 lines of pure functions that don't belong on the class |
| F5 | Move `getSessionTree()` to `manager-trace.ts` | S | P3 | Natural home for it |
| F2 | Guard imports barrel | S | P3 | Cosmetic noise reduction |
| F3 | `run()` length | — | P3 | Monitor, don't act — sequential setup isn't improved by splitting |

### What NOT to do
- **Don't split SubagentManager into multiple classes.** The shared state (`activeSessions`, `registry`, `agents`) is the reason it's one class. Splitting would create tightly coupled friends.
- **Don't create a SessionManager + AgentManager split.** Agents and sessions are inseparable at the orchestration level — a session IS an agent running a task.
- **Don't over-extract.** The satellite pattern works because the extracted modules are truly independent (no back-reference to the class). Forced extraction creates worse code.
