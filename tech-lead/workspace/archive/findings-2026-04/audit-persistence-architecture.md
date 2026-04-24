# Audit: persistence.ts Architecture Review

**Date**: 2026-04-14  
**File**: `src/lib/persistence.ts` (542 lines)  
**Auditor**: Scout (Lens A)

---

## Summary

persistence.ts is a well-organized, single-responsibility data-layer module. It contains **30 exported functions**, **1 class** (RegistryStore), **6 interfaces**, and **1 type alias**. Despite its size, every export is consumed — there are **zero dead exports**. The module has clear internal structure with 6 logical clusters. The main architectural concerns are sync/async duplication and the RegistryStore class being a thin wrapper over standalone functions.

## Export Census

| Category | Count |
|---|---|
| Exported functions | 30 |
| Exported class | 1 (RegistryStore) |
| Exported interfaces | 6 |
| Exported types | 1 (SessionKind) |
| Re-exported via index.ts | 22 functions + class |
| NOT re-exported (internal use only) | 8 functions |

### Functions Not Re-exported via index.ts
These are consumed directly by `src/lib/` modules, not by external consumers:
- `sessionExists` — only used in 1 test
- `clearSessionMessages` — only used in 1 test
- `historyDir` — used in manager.ts + 3 tests
- `archiveSession` — used in manager.ts + 1 test
- `readArchivedSessionMessages` — used in evaluator.ts + manager.ts + 1 test
- `sessionCompactPath` — only used in 1 test
- `saveCompactedMessages` — used in manager.ts + 1 test
- `readCompactedMessages` — used in manager.ts + 1 test

## 6 Logical Clusters

The file naturally organizes into these functional areas:

### 1. Path Helpers (lines 107–144) — 6 functions
`sessionDir`, `sessionJsonlPath`, `findSessionJsonl`, `sessionOutputDir`, `ensureSessionDir`, `sessionExists`

Pure path resolution + existence checks. No I/O beyond `existsSync`/`mkdirSync`. **Highly cohesive, well-bounded.**

### 2. Session JSONL I/O (lines 145–163) — 3 functions
`appendSessionMessage`, `readSessionMessages`, `clearSessionMessages`

Append-only message log operations. Uses the private `readJsonlFile` helper. **Clean and focused.**

### 3. History/Archive (lines 165–183) — 2 functions
`historyDir`, `archiveSession`

Session archival from active → history directory. **Minimal, correct.**

### 4. Session Meta.json (lines 186–274) — 7 sync + 4 async = 11 functions
Sync: `sessionMetaPath`, `readSessionMeta`, `writeSessionMeta`, `listActiveSessionIds`, `listArchivedSessionIds`, `loadAllSessionMetas`  
Async: `readSessionMetaAsync`, `listActiveSessionIdsAsync`, `listArchivedSessionIdsAsync`, `loadAllSessionMetasAsync`

**⚠️ This is the largest concern.** The 4 async functions are near-identical copies of their sync counterparts, differing only in `fs.promises` usage. The async variants are consumed:
- `loadAllSessionMetasAsync` → manager-health.ts (1 production consumer)
- `readSessionMetaAsync`, `listActiveSessionIdsAsync`, `listArchivedSessionIdsAsync` → **only re-exported via index.ts** (no direct production use)

**Recommendation**: The 3 unused async variants (`readSessionMetaAsync`, `listActiveSessionIdsAsync`, `listArchivedSessionIdsAsync`) could be removed — they're only re-exported as public API but have no actual consumers. Only `loadAllSessionMetasAsync` has a real user. Alternatively, keep only `loadAllSessionMetasAsync` (which internally calls the other three) and make the sub-functions private.

### 5. RegistryStore Class (lines 345–420) — 1 class
Implements `SessionStore` interface. Holds agents in memory, delegates all persistence to standalone functions (`writeSessionMeta`, `readSessionMeta`, `loadAllSessionMetas`).

**Observation**: RegistryStore is a thin wrapper — every method is a 1-3 line delegation to standalone functions. Its main value is:
1. Holding agent configs in memory (not persisted)
2. Providing the `SessionStore` interface for dependency injection in tests

Used in: `manager.ts` (primary), `requests.ts` (type reference), `index.ts` (re-export).

### 6. Workflow Run Persistence (lines 427–507) — 5 functions + 2 interfaces
`workflowRunDir`, `workflowRunPath`, `saveWorkflowRun`, `readWorkflowRun`, `listWorkflowRuns`

Complete CRUD for workflow runs as individual JSON files. Also includes `readArchivedSessionMessages` (misplaced here — belongs in cluster 2/3).

### 7. Rolling Compaction (lines 509–542) — 3 functions
`sessionCompactPath`, `saveCompactedMessages`, `readCompactedMessages`

Added later for session compaction. **Clean and self-contained.**

## Architectural Observations

### What's Good
1. **Zero dead exports** — Every function has at least one consumer.
2. **Consistent pattern** — All functions take `persistDir` as first argument, making them pure relative to filesystem root. No hidden global state.
3. **Atomic writes** — `writeSessionMeta` and `saveWorkflowRun` use tmp+rename pattern correctly.
4. **Clear separation** — RegistryStore handles the "store abstraction", standalone functions handle raw filesystem ops.
5. **Internal JSONL parser** is private and reused (`readJsonlFile`).

### Concerns

#### 1. Sync/Async Duplication (Medium)
4 async functions duplicate 4 sync functions nearly line-for-line (~80 lines of duplication). Only 1 async function has a production consumer. The other 3 exist as public API surface with no callers.

**Recommendation**: Remove the 3 unused async exports. If future callers need them, they can be trivially re-added.

#### 2. RegistryStore is Vestigial (Low)
The class exists to implement `SessionStore`, but `SessionStore` is only referenced in 2 files (`persistence.ts` itself, `index.ts` re-export). No production code depends on `SessionStore` as an interface — manager.ts hardcodes `RegistryStore`. The abstraction boundary exists for testability but is largely unused.

**Recommendation**: Keep as-is. The overhead is minimal and it provides a clean seam for testing.

#### 3. Triple Status Write Path (Medium — Prior Finding Confirmed)
Session status changes flow through three paths:
1. **meta.json** — RegistryStore.updateSessionStatus → writeSessionMeta (synchronous, filesystem)
2. **SQLite sessions** — DbWriter subscriber via EventBus (async, database)
3. **SQLite digests** — session-digest.ts (async, database)

The comment at line 16 acknowledges this: "DB writes removed from RegistryStore — handled by DbWriter subscriber via EventBus." This is architecturally sound (meta.json is source of truth, DB is async index), but the three write paths make it hard to reason about consistency.

**Recommendation**: Document the write-path hierarchy explicitly. meta.json is authoritative; SQLite is a derived view rebuilt from meta.json on startup if needed.

#### 4. `readArchivedSessionMessages` is Misplaced (Low)
This function sits in the "Workflow Run" section (line 492) but logically belongs with session JSONL I/O (cluster 2) or archive helpers (cluster 3).

**Recommendation**: Move it next to `readSessionMessages` for discoverability.

## Should This Be Split?

**No.** The 6 clusters are tightly related — they all operate on the same directory tree (`persistDir/sessions/`). Splitting would create circular dependencies (e.g., path helpers needed by both session and workflow modules) or force an artificial `persistence-paths.ts` module. The 542-line single file with clear section comments is the right granularity.

The only candidate for extraction would be **Workflow Run Persistence** (5 functions, 2 interfaces, ~80 lines) since it operates on a different directory subtree (`persistDir/workflows/`). But the shared atomic-write pattern and `persistDir` convention argue for keeping it together.

## Actionable Items

| Priority | Item | Effort | Impact |
|---|---|---|---|
| Medium | Remove 3 unused async exports (`readSessionMetaAsync`, `listActiveSessionIdsAsync`, `listArchivedSessionIdsAsync`) | 15 min | -40 lines, smaller API surface |
| Low | Move `readArchivedSessionMessages` next to `readSessionMessages` | 5 min | Better discoverability |
| Low | Add section header comment for Rolling Compaction cluster | 2 min | Consistency with other clusters |
| Info | Document triple-write-path hierarchy in a comment | 10 min | Future maintainability |
