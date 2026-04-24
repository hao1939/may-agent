# Proposal: Status Persistence Consolidation — Single-Writer Architecture

**Date**: 2026-04-11  
**Author**: tech-lead  
**Status**: PROPOSAL  
**Builds on**: audit-persistence-write-path.md, audit-completion-pipeline.md, audit-persistence-failure-cascade.md

---

## Problem Statement

Session status is written to **three independent stores** with no transactional coordination:

| Store | Writer | When | What's Written |
|-------|--------|------|----------------|
| **meta.json** (FS) | `RegistryStore.updateSessionStatus()` | Synchronously in `handleCompletionInner()` line 805 | status, error, endedAt |
| **SQLite sessions** | `DbWriter.handler()` via EventBus | After meta.json, via `session_end` bus event | status, error, outcome, opCount, endedAt |
| **SQLite digests** | `createDigestWriter()` via EventBus | Same bus event as DbWriter | outcome, what_happened, still_open, files_modified |

### Consequences of Triple-Write

1. **Crash inconsistency**: If the process crashes after meta.json write (line 805) but before `emit("session_end")` (line 831), meta.json says "done" but SQLite says "running". No reconciliation runs automatically.
2. **Total blackout on FS failure**: If meta.json write throws (disk full), the exception propagates up to `handleCompletion()`'s catch block, which tries to write meta.json *again* (line 717) — also fails. The bus event **never fires**, so DbWriter, DigestWriter, RequestTracker, ContextUpdater, AutoResume ALL skip.
3. **O(n) registry scan**: `getRegistry()` calls `loadAllSessionMetas()` which does `readdirSync` + `readFileSync` on every session directory (2,654+ active sessions). The same data exists in SQLite, indexed and queryable in ~10ms.
4. **Race condition mitigation**: `updateSessionDb()` uses `CASE WHEN ? > opCount THEN ? ELSE opCount END` to prevent manager/DbWriter race on opCount. This race only exists because two writers independently set the same field.
5. **No reader benefits from the duplication**: Every reader either needs *only* meta.json OR *only* SQLite. No reader cross-references both.

---

## Source of Truth Analysis

### Who reads what?

| Reader | Source | Purpose | Could use SQLite? |
|--------|--------|---------|-------------------|
| `RegistryStore.getRegistry()` | Scans ALL meta.json | Session tree, stale detection | ✅ Yes |
| `RegistryStore.getSession()` | Single meta.json | Session lookup | ✅ Yes |
| `cleanupStaleSessions()` | meta.json + [STARTED] sentinels | Crash recovery | ✅ Yes (sentinels still needed) |
| `cleanupZombieSessions()` | meta.json + SQLite | Zombie detection | ✅ Already uses SQLite in Phase 3 |
| `resumeSession()` | meta.json | Session reload | ✅ Yes (plus JSONL for messages) |
| Web UI `/session/:id` | SQLite + session.jsonl (FS) | Dashboard | Already SQLite |
| Web UI analytics | SQLite | Stats, counts | Already SQLite |
| `auto-pause.ts` | SQLite | Rate limiting | Already SQLite |
| `cron.ts` | SQLite | Job scheduling | Already SQLite |
| `evaluator.ts` | `loadAllSessionMetasAsync()` → meta.json | Evaluation targets | ✅ Could use SQLite |
| `manager-health.ts` | `loadAllSessionMetasAsync()` → meta.json | Health check | ✅ Could use SQLite |

**Key insight**: Only 5 callers read meta.json. All of them could read from SQLite instead. SQLite is already the source of truth for the web UI, auto-pause, cron, and analytics.

### What meta.json has that SQLite doesn't

| Field | In meta.json | In SQLite sessions | Notes |
|-------|:---:|:---:|-------|
| `pid` | ✅ | ❌ | Used for `isProcessAlive()` in crash recovery |
| `instance` | ✅ | ❌ | Multi-instance support |
| `autoClose` | ✅ | ❌ | Chat vs task lifecycle |
| `maxTurns` | ✅ | ❌ | Persisted for crash recovery |
| `orderId` | ✅ | ❌ | Human order link |
| `detached` | ✅ | ❌ | Detached session flag |

These 6 fields are only in meta.json. The SQLite `sessions` table would need to be extended to hold them.

---

## Proposed Architecture: SQLite as Single Writer

### Phase 1: Protect the Critical Path (P0, ~30 min)

**Goal**: Prevent meta.json failure from killing the entire completion pipeline.

**Change**: Wrap `registry.updateSessionStatus()` in try-catch in `handleCompletionInner()`:

```typescript
// manager.ts line 805
try {
  this.registry.updateSessionStatus(session.sessionId, outcome.archiveStatus, session.error);
} catch (err) {
  log("error", `[completion] meta.json write failed for ${session.sessionId}: ${err}`);
  // Continue — bus event will still fire, DbWriter will persist to SQLite
}
```

**Impact**: The bus event fires even if meta.json fails. SQLite becomes the fallback authority. No schema changes needed.

### Phase 2: Add Missing Columns to SQLite (P1, ~1 hour)

**Goal**: Make SQLite capable of being the sole source of truth.

**Change**: Add the 6 missing columns to the `sessions` table:

```sql
ALTER TABLE sessions ADD COLUMN pid INTEGER;
ALTER TABLE sessions ADD COLUMN instance TEXT;
ALTER TABLE sessions ADD COLUMN autoClose TEXT;
ALTER TABLE sessions ADD COLUMN maxTurns INTEGER;
ALTER TABLE sessions ADD COLUMN orderId TEXT;
ALTER TABLE sessions ADD COLUMN detached INTEGER DEFAULT 0;
```

Update `upsertSession()` and `updateSessionDb()` in `requests.ts` to include these fields. Update `DbWriter.handler()` to pass them through on `session_start`.

**Impact**: SQLite now has everything meta.json has. Both stores are feature-complete.

### Phase 3: Replace `loadAllSessionMetas()` with SQLite Query (P1, ~2 hours)

**Goal**: Eliminate the O(n) filesystem scan that reads 2,654+ meta.json files.

**Change**: Add a `queryAllSessions()` function to `requests.ts`:

```typescript
export function queryAllSessions(persistDir: string): Record<string, PersistedSession> {
  const db = getDb(persistDir);
  const rows = db.prepare("SELECT * FROM sessions").all() as SessionDbRow[];
  const result: Record<string, PersistedSession> = {};
  for (const row of rows) {
    result[row.sessionId] = dbRowToPersistedSession(row);
  }
  return result;
}
```

Replace `getRegistry()` in `RegistryStore`:

```typescript
getRegistry(): Registry {
  return {
    agents: { ...this.agents },
    sessions: queryAllSessions(this.persistDir),  // was: loadAllSessionMetas(this.persistDir)
  };
}
```

Similarly, replace `loadAllSessionMetasAsync()` callers in `evaluator.ts` and `manager-health.ts`.

**Impact**: O(n) FS reads → single SQLite query. ~2,654 `readFileSync` calls eliminated per `getRegistry()` invocation.

### Phase 4: Demote meta.json to Write-Through Cache (P2, ~3 hours)

**Goal**: Keep meta.json for backward compatibility but make SQLite authoritative.

**Changes**:
1. `RegistryStore.getSession()` → reads from SQLite first, falls back to meta.json
2. `RegistryStore.getRegistry()` → already changed in Phase 3
3. `cleanupStaleSessions()` → reads from SQLite, only accesses FS for [STARTED] sentinels
4. meta.json still written (for external tooling, debug inspection) but never read as source of truth

**Impact**: meta.json becomes a debugging artifact. All runtime reads go to SQLite.

### Phase 5: Eliminate Redundant Digest Status (P3, ~1 hour)

**Goal**: Stop writing session status to the digests table redundantly.

The `session_digests` table stores `outcome` and `what_happened` on the END digest. This duplicates `sessions.status` and `sessions.outcome`. However, digests serve a different purpose — they're the **narrative log** (what happened, what's still open, files modified). They're not a status store; they're a context store.

**Decision**: Keep digests as-is. They serve a distinct purpose (narrative context injection for future sessions) and don't need consolidation with the status store. The "triple-redundant status" is really **double-redundant** (meta.json + SQLite sessions) plus one **derivative** (digests which happen to include outcome).

---

## Migration Path

```
Current:                          Target:
┌─────────┐  ┌──────────┐       ┌──────────┐
│meta.json │  │SQLite    │       │SQLite    │  ← AUTHORITY
│(FS)      │  │sessions  │       │sessions  │
│AUTHORITY │  │(index)   │       │(extended)│
└─────────┘  └──────────┘       └──────────┘
     │             │                  │
     │  ┌──────────┐            ┌─────────┐
     │  │SQLite    │            │meta.json│  ← CACHE (write-through, never read at runtime)
     │  │digests   │            │(FS)     │
     │  └──────────┘            └─────────┘
     │                               │
     ├── Phase 1: try-catch      ┌──────────┐
     ├── Phase 2: add columns    │SQLite    │  ← UNCHANGED (narrative log, not status store)
     ├── Phase 3: swap readers   │digests   │
     ├── Phase 4: demote FS      └──────────┘
     └── Phase 5: clarify digests
```

### Phase Ordering

| Phase | Depends On | Risk | Rollback |
|-------|-----------|------|----------|
| 1 (try-catch) | Nothing | None | Remove try-catch |
| 2 (add columns) | Nothing | Low — additive schema change | Columns are nullable, ignore them |
| 3 (swap readers) | Phase 2 | Medium — changes all session reads | Revert to `loadAllSessionMetas()` |
| 4 (demote meta.json) | Phase 3 | Medium — changes crash recovery path | Re-read from meta.json |
| 5 (clarify digests) | Nothing | None — no code change, just documentation |

**Phases 1 and 2 can ship independently with zero risk.** Phase 3 is the big behavioral change.

---

## What We Gain

### Performance
- **Eliminate 2,654+ `readFileSync` calls** per `getRegistry()` invocation
- Replace O(n) filesystem scan with indexed SQLite query (~10ms)
- `loadAllSessionMetasAsync()` (used by evaluator, health check) also eliminated

### Reliability  
- **No more total blackout** on meta.json write failure (Phase 1)
- **No more permanent divergence** between meta.json and SQLite after crash
- Single source of truth eliminates the need for reconciliation logic
- The `CASE WHEN ? > opCount` race condition in `updateSessionDb()` becomes unnecessary — single writer means no race

### Simplicity
- `RegistryStore` shrinks from "read/write meta.json + delegate to bus" to "thin SQLite wrapper"
- `cleanupZombieSessions()` Phase 3 (DB/disk mismatch fix) becomes unnecessary — there's only one store
- No more need to keep `loadAllSessionMetas()`, `loadAllSessionMetasAsync()`, `listActiveSessionIds()`, `listArchivedSessionIds()` for status reads

### What We Keep
- **meta.json for debugging**: Human-readable session state, inspectable with `cat`/`jq`
- **[STARTED] sentinels**: Belt-and-suspenders crash detection (not in SQLite, stays on FS)
- **session.jsonl**: Append-only message log (replay source of truth, not status)
- **Digests**: Narrative context log (distinct from status persistence)

---

## Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| SQLite DB corruption | High | WAL mode + periodic backups. SQLite is more resilient than individual JSON files. |
| External tools reading meta.json | Low | Keep writing it as cache. Add deprecation comment. |
| `getDb()` lazy init timing | Medium | Phase 3 must ensure DB is initialized before `getRegistry()` is called. Currently true — DB initializes in `SubagentManager` constructor. |
| Phase 3 changes crash recovery semantics | Medium | Run parallel reads (SQLite + meta.json) for one release, log divergences, then cut over. |
| Losing meta.json-only fields (pid, instance, etc.) during transition | Medium | Phase 2 adds all fields BEFORE Phase 3 changes readers. Schema migration is additive. |

---

## What This Does NOT Address

1. **Session archival**: Active sessions growing unbounded (2,654+) is a separate issue. See audit-persistence-write-path.md P0.
2. **Double escalation**: `escalateBlockedSession()` + anonymous subscriber firing twice. See audit-completion-pipeline.md Proposal 3.
3. **Digest write path consolidation**: Inline `upsertDigest()` calls in `handleCompletionInner()` vs. `createDigestWriter()` subscriber. Digests serve a different purpose and don't need single-writer treatment.
4. **JSONL message persistence**: `appendSessionMessage()` has no error handling. See audit-persistence-failure-cascade.md Fix 2.

---

## Recommended Implementation Order

1. **Now**: Phase 1 (try-catch around meta.json write) — 30 min, zero risk, prevents worst failure mode
2. **This week**: Phase 2 (add SQLite columns) — 1 hour, additive, no behavioral change
3. **Next week**: Phase 3 (swap readers) — 2 hours, the key behavioral change, needs testing
4. **Later**: Phase 4 (demote meta.json) — only after Phase 3 is stable for a few days
5. **Optional**: Phase 5 (document digest purpose) — whenever convenient

**Total effort**: ~7 hours across 5 phases, with each phase independently shippable and reversible.

---

## Verdict

The triple-redundant status write is **real technical debt with real failure modes**. The worst case (meta.json failure → total downstream blackout) is a genuine production risk. The fix path is incremental — Phase 1 alone (30 minutes) eliminates the worst failure mode, and Phase 3 (2 hours) delivers the main performance win.

SQLite should be the single source of truth for session status. meta.json should be demoted to a write-through debugging cache. Digests are not a status store — they're a narrative log and should remain separate.
