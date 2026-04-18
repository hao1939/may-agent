# Audit: Persistence Write Path Complexity

**Date**: 2026-04-11  
**Lens**: B (complexity trace)  
**Focus**: How many writes does a session lifecycle trigger? Where is data duplicated?

## 1. The Write Path — Full Trace

### Session Start (manager.ts `startSession`)
| # | Operation | Target | Purpose |
|---|-----------|--------|---------|
| 1 | `mkdirSync` | `sessions/<id>/` | Create session directory |
| 2 | `mkdirSync` | `sessions/<id>/output/` | Create output subdirectory |
| 3 | `writeFileSync` | `sessions/<id>/[STARTED]` | Sentinel for crash detection |
| 4 | `writeSessionMeta` | `sessions/<id>/meta.json` (.tmp→rename) | Initial session metadata |
| 5 | EventBus `session_start` → `DbWriter` | SQLite `sessions` table | `INSERT OR REPLACE` |
| 6 | EventBus `session_start` → `DigestWriter` | SQLite `session_digests` table | `INSERT` start digest |
| 7 | EventBus `session_start` → `ActivityWriter` | Activity tracking | (minor) |

**7 I/O operations** to create a session.

### Per Turn (message loop)
| # | Operation | Target | Purpose |
|---|-----------|--------|---------|
| 8 | `appendSessionMessage` | `sessions/<id>/session.jsonl` | Append each message |

Plus tool-specific writes (read/write/edit/bash results). Each turn with an assistant message increments `turnCount`.

### Session End (manager.ts `handleCompletion`)
| # | Operation | Target | Purpose |
|---|-----------|--------|---------|
| 9 | `RegistryStore.updateSessionStatus` | `sessions/<id>/meta.json` (.tmp→rename) | Status → done/error/interrupted |
| 10 | `unlinkSync` | `sessions/<id>/[STARTED]` | Remove sentinel |
| 11 | EventBus `session_end` → `DbWriter` | SQLite `sessions` table | `UPDATE` status, error, outcome |
| 12 | EventBus `session_end` → `DigestWriter` | SQLite `session_digests` table | `INSERT` end digest |
| 13 | EventBus `session_end` → `ContextUpdater` | `agents/<name>/context.md` | Apply context_updates from finish() |
| 14 | EventBus `session_end` → `RequestTracker` | SQLite `requests` table | Mark completed_items, track new_items |
| 15 | EventBus `session_end` → `AutoResume` | (conditional) Schedule retry | If interrupted + work done |

**7+ I/O operations** on completion, plus conditional digest writes for overflow/shallow heartbeat.

### Total per session lifecycle: ~15+ synchronous I/O operations

## 2. Data Duplication Map

The same session data lives in **three** stores:

| Data Point | meta.json (FS) | SQLite sessions | SQLite digests |
|------------|:-:|:-:|:-:|
| sessionId | ✓ | ✓ | ✓ |
| agent | ✓ | ✓ | ✓ |
| task | ✓ | ✓ | ✓ |
| status | ✓ | ✓ | ✓ |
| startedAt | ✓ | ✓ | ✓ |
| endedAt | ✓ | ✓ | ✓ |
| error | ✓ | ✓ | ✓ |
| outcome | — | ✓ | ✓ |
| parentSessionId | ✓ | ✓ | — |
| kind | ✓ | ✓ | — |
| opCount | ✓ | ✓ | ✓ (in details) |

**Every field in meta.json is duplicated in SQLite.** The SQLite DB has *additional* fields (outcome, opCount in sessions table) that meta.json doesn't carry.

### Who reads what?

| Reader | Source |
|--------|--------|
| `RegistryStore.getRegistry()` | Scans ALL meta.json files (2,654 dirs!) |
| `RegistryStore.getSession()` | Reads single meta.json |
| Crash recovery (`cleanupStaleSessions`) | Reads meta.json + [STARTED] sentinels |
| DbWriter queries (request tracker, system-status) | SQLite |
| Digest context injection | SQLite digests |
| Web UI (`/session/:id`) | session.jsonl from FS |
| `loadAllSessionMetas()` | Scans ALL meta.json files |

**Key finding**: `RegistryStore.getRegistry()` scans 2,654 directories on every call, reading meta.json from each. This is O(n) in total sessions and gets slower as sessions accumulate.

## 3. Dead Code: `archiveSession()`

**persistence.ts:172** exports `archiveSession()` which moves sessions from `sessions/<id>/` to `sessions/history/<id>/`.

- **Zero callers** in production code (no imports, no usage anywhere in src/)
- **17,222 sessions** sit in history/ — these were bulk-migrated by a script circa March 2026
- **2,654 sessions** accumulate in the active directory since archiving stopped
- The `loadAllSessionMetas()` function only scans `sessions/` (active), not `sessions/history/`
- `readSessionMeta()` checks both active and history paths
- `readSessionMessages()` checks both active and history paths

**This means**: Active session count grows unbounded. The registry scan gets proportionally slower. No mechanism moves completed sessions to history.

## 4. Findings

### Finding 1: Triple-redundant status persistence
Session status is written to **three** stores on every completion:
1. meta.json (RegistryStore.updateSessionStatus) 
2. SQLite sessions table (DbWriter)
3. SQLite digests table (DigestWriter)

All three happen synchronously in the same event loop tick via the EventBus. If any fails, the others still succeed, creating potential inconsistency.

**Simplification**: meta.json could be eliminated entirely. SQLite is the more reliable, queryable store. The only reader that *requires* meta.json is `RegistryStore.getRegistry()` — which could query SQLite instead.

### Finding 2: `archiveSession()` is dead code
Exported, never called, and the system relies on it conceptually (history/ directory exists, readers check both paths) but doesn't actually execute it.

**Impact**: 2,654+ session directories accumulate in `sessions/`, and `loadAllSessionMetas()` scans all of them. This is a ticking performance bomb.

**Fix (immediate)**: Either wire `archiveSession()` back into the completion path, or add a cron job that periodically archives completed sessions.

### Finding 3: Session directory scan is O(n) and unbounded
`RegistryStore.getRegistry()` calls `loadAllSessionMetas()` which does `readdirSync` + `readFileSync` on every session directory. With 2,654 active sessions, this is ~2,654 `readFileSync` calls every time the registry is queried.

The registry is queried:
- On every `cleanupStaleSessions()` call (process start)
- By health checks
- By system-status tool

**Simplification**: Replace `loadAllSessionMetas()` with a SQLite query. The data is already there via DbWriter.

### Finding 4: Sentinel files ([STARTED]) are redundant with PID tracking
The `[STARTED]` sentinel file is written at session start and deleted at session end. Its purpose is crash detection — if the file exists but the process isn't alive, the session crashed.

However, the crash detection code (`cleanupStaleSessions`) ALSO checks `isProcessAlive(persisted.pid)` from meta.json. The sentinel is only useful as a *second* signal confirming the session was mid-execution.

**This is actually reasonable** — belt-and-suspenders for crash detection. Not worth removing unless meta.json is eliminated.

### Finding 5: `subscribeForPersistence` is minimal but could be dangerous
The per-session subscriber (`session.agent.subscribe`) only handles `message_end` events to append to session.jsonl. This is correct and necessary — the JSONL log is the replay-able message history. No redundancy issue here.

## 5. Simplification Recommendations (Ranked)

### P0: Wire `archiveSession` into completion or add cron cleanup
The session directory is growing unbounded. Either:
- Add `archiveSession()` call in `cleanupSession()` after status is written, OR
- Add a cron job: `for each session with status done/error/interrupted older than 24h: archiveSession()`

**Effort**: ~5 lines. **Impact**: Prevents unbounded growth of the active session scan.

### P1: Replace `loadAllSessionMetas()` with SQLite query
The full registry scan reads 2,654+ files. The same data exists in SQLite. Replace:
```typescript
// Before: O(n) filesystem scan
getRegistry(): Registry {
  return { agents: this.agents, sessions: loadAllSessionMetas(this.persistDir) };
}

// After: O(n) SQLite query (indexed, cached, ~10ms)
getRegistry(): Registry {
  const sessions = queryAllSessions(this.persistDir); // SELECT * FROM sessions WHERE status IN ('running', 'idle')
  return { agents: this.agents, sessions };
}
```

**Effort**: ~30 lines. **Impact**: O(n) FS reads → single SQLite query. Major perf win.

### P2: Eliminate meta.json entirely (long-term)
Once `loadAllSessionMetas()` uses SQLite, meta.json has only one remaining purpose: providing session data *before* the process starts (i.e., before DbWriter is initialized). But the SQLite DB is opened at process start, so this isn't actually a constraint.

**Effort**: ~100 lines across persistence.ts, RegistryStore. **Impact**: Eliminates one of the three redundant write paths, simplifies RegistryStore to a thin SQLite wrapper.

### P3: Remove dead `archiveSession` export (if P0 chooses cron approach instead)
If we add a cron archiver instead of wiring `archiveSession` into completion, clean up the unused export. If we wire it in (preferred), this becomes moot.

## 6. Session Data Flow Diagram

```
                            ┌─────────────────────────────┐
  startSession()            │       EventBus               │
  ──────────────            │                              │
  ┌─meta.json───┐  emit──>│  session_start               │
  │ FS write #1  │          │    ├── DbWriter (SQLite)     │
  └──────────────┘          │    ├── DigestWriter (SQLite)  │
  ┌─[STARTED]───┐          │    └── ActivityWriter         │
  │ FS write #2  │          │                              │
  └──────────────┘          │  message_end                 │
                            │    └── appendSessionMessage   │
  handleCompletion()        │                              │
  ──────────────────        │  session_end                 │
  ┌─meta.json───┐  emit──>│    ├── DbWriter (SQLite)     │
  │ FS write #3  │          │    ├── DigestWriter (SQLite)  │
  │ (status)     │          │    ├── ContextUpdater (FS)   │
  └──────────────┘          │    ├── RequestTracker (SQLite)│
  ┌─[STARTED]───┐          │    ├── AutoResume (timer)    │
  │ FS delete    │          │    └── StuckDetector (timer)  │
  └──────────────┘          └─────────────────────────────┘
```

**The core problem**: meta.json writes duplicate what DbWriter writes to SQLite. The two stores can diverge on crash (meta.json written, bus event not yet processed → inconsistency).

## 7. Risk Assessment

| Risk | Severity | Likelihood |
|------|----------|------------|
| Session directory grows unbounded (no archiving) | Medium | **Certain** (happening now) |
| `loadAllSessionMetas()` becomes slow at scale | Medium | High (2,654 and growing) |
| meta.json / SQLite divergence on crash | Low | Low (sync in same tick) |
| Lost bus events (subscriber throws) | Low | Low (try/catch per subscriber) |

## Verdict

The persistence write path is **correct but redundant**. The system writes session status to three stores (meta.json, SQLite sessions, SQLite digests) when one (SQLite) would suffice. The dead `archiveSession()` function means active sessions grow unbounded.

**Immediate action**: Wire `archiveSession()` into completion or add cron cleanup (P0).  
**Next simplification**: Replace `loadAllSessionMetas()` FS scan with SQLite query (P1).
