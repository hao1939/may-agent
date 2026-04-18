# Audit: manager-utils.ts Architecture Review (Lens A)

**Date**: 2026-04-13  
**File**: `src/lib/manager-utils.ts` (319 lines)  
**Scope**: Cohesion, dependency direction, dead code, architectural concerns  

---

## 1. Function/Export Inventory

| Export | Kind | Lines | Category |
|--------|------|-------|----------|
| `generateId()` | function | 27-30 | ID generation |
| `formatDuration()` | function | 42-48 | Formatting |
| `getAgentDir()` | function | 55-58 | Path resolution |
| `extractLastAssistantText()` | function | 60-72 | Message parsing |
| `truncateForPrompt()` | function | 76-80 | Formatting |
| `isProcessAlive()` | function | 85-93 | Process helpers |
| `isToolError()` | function | 101-123 | Error detection |
| `computeToolArgsKey()` | function | 129-135 | Error detection |
| `STATE_CHANGING_TOOLS` | const | 142 | Constants |
| `INFRA_RETRY_MAX` | const | 148 | Constants |
| `INFRA_RETRY_BASE_DELAY_MS` | const | 151 | Constants |
| `TOOL_PIVOT_LIMIT` | const | 154 | Constants |
| `RESTORED_MAX_TURNS_FALLBACK` | const | 157 | Constants (deprecated) |
| `TURN_BUDGET_TIERS` | const | 162-166 | Constants (experiment) |
| `TURN_BUDGET_GRACE` | const | 169 | Constants (experiment) |
| `STUCK_WARNING_THRESHOLD` | const | 172 | Constants |
| `STUCK_TERMINATE_THRESHOLD` | const | 175 | Constants |
| `RegisteredAgent` | interface | 179-181 | Types |
| `ActiveSession` | interface | 183-258 | Types |
| `RunOptions` | interface | 261-295 | Types |
| `SubagentManagerOptions` | interface | 297-316 | Types |
| `ManagerEventBus` | interface | 318-320 | Types |

**Total: 10 functions, 8 constants, 5 interfaces.**

---

## 2. Cohesion Analysis

The file serves as a **grab-bag** with 5 distinct concern clusters:

| Cluster | Exports | Cohesion |
|---------|---------|----------|
| **A: Types/Interfaces** | `RegisteredAgent`, `ActiveSession`, `RunOptions`, `SubagentManagerOptions`, `ManagerEventBus` | High internal cohesion — all describe manager data shapes |
| **B: Session lifecycle constants** | `INFRA_RETRY_MAX`, `INFRA_RETRY_BASE_DELAY_MS`, `TOOL_PIVOT_LIMIT`, `STUCK_*`, `STATE_CHANGING_TOOLS`, `RESTORED_MAX_TURNS_FALLBACK` | Moderate — all relate to session policy |
| **C: Experiment constants** | `TURN_BUDGET_TIERS`, `TURN_BUDGET_GRACE` | New addition, experiment-scoped |
| **D: Tool error detection** | `isToolError()`, `computeToolArgsKey()` | High — tightly related functions |
| **E: Miscellaneous helpers** | `generateId()`, `formatDuration()`, `getAgentDir()`, `extractLastAssistantText()`, `truncateForPrompt()`, `isProcessAlive()` | **Low** — 6 unrelated utility functions |

**Verdict**: Cluster E is the grab-bag problem. These functions have nothing in common except "used somewhere in manager.*". The file header says "Pure utility functions" which is an admission of low cohesion.

---

## 3. Consumer Map

| Consumer | What it imports |
|----------|----------------|
| `manager.ts` | `generateId`, `truncateForPrompt`, `INFRA_RETRY_MAX`, `RESTORED_MAX_TURNS_FALLBACK`, `TURN_BUDGET_GRACE` + all 4 types |
| `manager.ts` (re-exports) | `generateId`, `truncateForPrompt`, `computeToolArgsKey`, `isToolError`, `getAgentDir`, `STATE_CHANGING_TOOLS`, `INFRA_RETRY_MAX`, `TOOL_PIVOT_LIMIT` + all 4 types |
| `manager-retry.ts` | `INFRA_RETRY_BASE_DELAY_MS`, `ActiveSession` type |
| `manager-health.ts` | `formatDuration`, `RegisteredAgent`, `ActiveSession` types |
| `manager-receipts.ts` | `computeToolArgsKey`, `STATE_CHANGING_TOOLS`, `TOOL_PIVOT_LIMIT`, `STUCK_WARNING_THRESHOLD`, `ActiveSession` type |
| `completion.ts` | `formatDuration`, `ActiveSession` type |
| `manager-agents-tool.ts` | `ActiveSession`, `RegisteredAgent` types |
| `manager-trace.ts` | `ActiveSession` type |
| `cron.ts` | `TURN_BUDGET_TIERS` |

**Key observation**: 5 of 8 consumers import **only types** or types + 1-2 items. The types are the most-consumed part of this file.

---

## 4. Dependency Direction

```
manager-utils.ts imports from:
  - node:crypto (for computeToolArgsKey hash)
  - node:path (for getAgentDir dirname)
  - @mariozechner/pi-agent-core (AgentMessage, Agent types)
  - ./types.js (SubagentDefinition, SessionInfo, FinishResult)
  - ./compaction.js (CompactionOptions type)
  - ./persistence.js (SessionKind type)
  - ./api-gate.js (ApiGate type — inline import in interface)
```

**Direction is correct**: utils → core types only. No circular deps. No imports from manager.ts or higher-level modules. The inline `import("./api-gate.js")` and `import("./types.js")` in interface fields are type-only and don't create runtime deps.

---

## 5. Dead / Deprecated Code

| Item | Status | Evidence |
|------|--------|----------|
| `RESTORED_MAX_TURNS_FALLBACK` | **Deprecated** | JSDoc says "Turn limits removed — always 0". Still imported by `manager.ts`. |
| `STUCK_TERMINATE_THRESHOLD` | **Shadowed/Dead** | Exported from manager-utils but **not imported anywhere**. `session-subscribers.ts` defines its own local copy (`= 6`, vs `= 5` here). The manager-utils export is dead. |
| `STUCK_WARNING_THRESHOLD` | **Shadowed** | Same pattern — `session-subscribers.ts` defines its own local (`= 4` vs `= 3` here). Only `manager-receipts.ts` imports the manager-utils version. Two sources of truth with **different values**. |
| `isProcessAlive()` | **Active** | Imported by `manager.ts`, used in session recovery (lines 1170, 1197). `cron.ts` has its own private method — duplication but not dead. |
| `extractLastAssistantText()` | **Active** | Imported by `manager.ts`, used in 4 call sites (result extraction, session info building). |

---

## 6. Findings Summary

### F-1: Low cohesion grab-bag (Severity: LOW)
**What**: 6 unrelated helper functions sharing a file only because they were extracted from manager.ts.  
**Impact**: Minor — file is 319 lines, not unmanageable. But each new addition (like TURN_BUDGET_TIERS) continues the grab-bag pattern.  
**Recommendation**: No action now. If the file grows past ~400 lines, split types into `manager-types.ts` and keep runtime helpers here.

### F-2: Shadowed STUCK constants — divergent values (Severity: MEDIUM)
**What**: `STUCK_WARNING_THRESHOLD` (3) and `STUCK_TERMINATE_THRESHOLD` (5) are exported from manager-utils, but `session-subscribers.ts` defines its own locals with **different values** (4 and 6). The manager-utils `STUCK_TERMINATE_THRESHOLD` is dead (not imported anywhere). The `STUCK_WARNING_THRESHOLD` is imported by `manager-receipts.ts` (value 3) while `session-subscribers.ts` uses its own (value 4).  
**Impact**: Two subsystems use different thresholds for the same concept. If someone changes the manager-utils constants expecting system-wide effect, session-subscribers won't be affected.  
**Recommendation**: Consolidate — `session-subscribers.ts` should import from manager-utils, or delete the manager-utils versions and let each consumer own its thresholds explicitly.

### F-3: Deprecated RESTORED_MAX_TURNS_FALLBACK still consumed (Severity: LOW)
**What**: Marked `@deprecated` but still imported by `manager.ts`.  
**Impact**: Confusion — the constant is 0 (unlimited), and the new TURN_BUDGET_TIERS system supersedes it.  
**Recommendation**: Inline the `0` at the usage site in manager.ts and remove the export after the experiment ships.

### F-4: manager.ts re-export proxy pattern (Severity: INFORMATIONAL)
**What**: manager.ts re-exports 8 values + 4 types from manager-utils for backward compat.  
**Impact**: Works fine but creates two valid import paths for the same symbol. Consumers are split — some import from `manager-utils` directly, others from `manager`.  
**Recommendation**: Accept the pattern. Consolidating would churn every import site.

### F-5: Experiment constants lack graduation path (Severity: LOW)
**What**: `TURN_BUDGET_TIERS` and `TURN_BUDGET_GRACE` are marked experimental but live in the shared constants file.  
**Impact**: If the experiment fails, two constants need removal from a shared file with many consumers.  
**Recommendation**: Acceptable for now. The `EXP-` comment prefix makes them easy to find.

---

## Overall Assessment

**manager-utils.ts is healthy.** At 319 lines with clear section headers, it's a well-organized utility module. The grab-bag pattern is acknowledged but not yet a problem. The dependency direction is correct (utils imports only types/core, never higher-level modules). Dead code is minimal (1 unused constant, 1 deprecated constant). No architectural risks.
