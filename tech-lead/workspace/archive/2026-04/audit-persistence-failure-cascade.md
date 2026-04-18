# Audit: Persistence Failure Cascade Blast Radius

**Date**: 2026-04-11  
**Lens**: D (fragility)  
**Focus**: What happens when persistence writes fail? Is data lost, corrupted, or silently dropped?  
**Builds on**: [audit-persistence-write-path.md](./audit-persistence-write-path.md)

## Executive Summary

The persistence layer has **five independent write targets** (meta.json, SQLite sessions, SQLite digests, SQLite requests, context.md) with **no transactional coordination**. Each target has its own error handling:

| Write Target | Error Handling | Blast Radius on Failure |
|---|---|---|
| meta.json (RegistryStore) | **None** — throws to caller | Kills the completion pipeline; catch in handleCompletion writes "error" status |
| SQLite sessions (DbWriter) | try-catch in handler, logs error | Silent data loss — session never recorded in DB |
| SQLite digests (DigestWriter) | try-catch in subscriber, logs warning | Silent — digest missing but harmless |
| SQLite requests (RequestTracker) | try-catch per operation, best-effort | Silent — completed_items not marked, new_items not tracked |
| context.md (ContextUpdater) | try-catch, best-effort | Silent — context updates lost |

**The critical finding**: meta.json writes have NO try-catch and can crash the completion pipeline. The EventBus isolates subscribers from each other (each call is wrapped in try-catch), so a DbWriter failure won't kill DigestWriter. But meta.json is written BEFORE the bus event fires, outside the bus's protection.

## 1. Failure Scenario Analysis

### Scenario A: meta.json write fails (disk full, permissions, etc.)

**Location**: `RegistryStore.updateSessionStatus()` → `writeSessionMeta()` (persistence.ts:174)

**What happens**:
1. `writeSessionMeta` calls `writeFileSync(tmpPath, ...)` → if this throws (disk full), the error propagates up
2. If `renameSync(tmpPath, filePath)` fails, the `.tmp` file exists but meta.json is stale
3. The throw propagates to `handleCompletionInner()` line 790: `this.registry.updateSessionStatus(...)` 
4. `handleCompletion()`'s outer catch fires (line 693):
   - Sets `session.error = "handleCompletion failed: ..."`
   - Tries AGAIN to write meta.json: `this.registry.updateSessionStatus(session.sessionId, "error", session.error)` — **this will also fail** (same disk condition)
   - Falls through to best-effort cleanup
5. Session is removed from `activeSessions` map, so it won't be retried
6. **The EventBus `session_end` event is NEVER emitted** — so DbWriter, DigestWriter, RequestTracker, ContextUpdater, AutoResume ALL skip this session

**Blast radius**: **TOTAL** — no downstream subscriber runs. The session has:
- Stale meta.json (still says "running")
- No SQLite update (still says "running" in DB)
- No digest end entry
- No request tracking updates
- Process thinks session is cleaned up (removed from activeSessions)
- On restart, `cleanupStaleSessions` will find the stale meta.json with status "running" but no [STARTED] sentinel → will try to mark it interrupted

**Data corruption risk**: The `.tmp` file may be left behind, but `writeSessionMeta` always writes to `.tmp` then renames, so the original meta.json is never partially written. The risk is **stale data**, not **corrupt data**.

### Scenario B: SQLite write fails in DbWriter

**Location**: `DbWriter.handler()` (db-writer.ts:17-61)

**What happens**:
1. The entire handler is wrapped in a single try-catch (line 17/59)
2. Error is logged: `console.error("[db-writer] Error persisting session_end:", err.message)`
3. Execution continues — other subscribers still fire
4. meta.json has already been updated (it runs before the bus emit)

**Blast radius**: **CONTAINED** — meta.json is correct, other subscribers fire normally. SQLite `sessions` table is stale (still shows "running"). This creates a **meta.json ↔ SQLite divergence** that has no reconciliation mechanism.

**Who's affected by SQLite being wrong**:
- System-status tool queries SQLite → shows stale "running" session
- Request tracker queries SQLite → won't match pending requests correctly
- Digest context injection → may include stale session in context
- `loadAllSessionMetas()` reads meta.json → still correct

### Scenario C: DigestWriter throws

**Location**: `createDigestWriter()` subscriber (session-subscribers.ts)

**What happens**:
1. Inner try-catch logs warning: `log("warn", "[digest-subscriber] end failed: ...")`
2. EventBus outer try-catch would also catch if inner missed something
3. All other subscribers fire normally

**Blast radius**: **MINIMAL** — a missing digest entry. No functional impact on session lifecycle.

### Scenario D: RequestTracker throws  

**Location**: `createRequestTracker()` subscriber (session-subscribers.ts)

**What happens**:
1. Every operation is wrapped in its own try-catch with `/* best-effort */` comment
2. Even the outer loop has try-catch
3. If the DB query to find pending requests fails, no completed_items are marked

**Blast radius**: **LOW** — stale request status. The request stays "IN_PROGRESS" instead of "COMPLETED". An agent checking their pending requests will see a ghost task. No data corruption.

### Scenario E: appendSessionMessage fails (per-turn JSONL write)

**Location**: `subscribeForPersistence()` → `appendSessionMessage()` (manager.ts:280-281)

**What happens**:
1. `appendFileSync` throws (disk full, permissions)
2. The error propagates into the agent's event handler — this is NOT on the EventBus, it's on `session.agent.subscribe()`
3. The pi-agent-core library catches this in its event emission loop
4. The current message is LOST from the JSONL transcript
5. Session continues running — the message was already sent/received by the LLM

**Blast radius**: **DATA LOSS** — the message is gone from the session transcript. No retry, no error handling. The session continues but its JSONL history is now incomplete. On crash recovery, the session would resume from a stale transcript. This is a **silent data loss** scenario.

**No try-catch**: `appendSessionMessage` in persistence.ts is a bare `appendFileSync` call with zero error handling:
```typescript
export function appendSessionMessage(persistDir: string, sessionId: string, message: AgentMessage): void {
  const line = JSON.stringify(message) + "\n";
  appendFileSync(sessionJsonlPath(persistDir, sessionId), line, "utf-8");  // no try-catch!
}
```

### Scenario F: Process crash mid-completion

**Location**: Anywhere in `handleCompletionInner()` during the write sequence

**Write ordering**:
1. `registry.updateSessionStatus()` → writes meta.json (line 790)
2. `session.unsubscribe()` → removes event listener
3. `removeSentinel()` → deletes [STARTED] file (line 793)
4. `cleanupSession()` → cleans step counter (line 794)
5. `activeSessions.delete()` → removes from memory (line 795)
6. `emit({ type: "session_end" })` → fires bus subscribers (line 816-831)

**If crash after step 1 but before step 6**:
- meta.json says "done" ✓
- SQLite says "running" ✗ (bus never fired)
- [STARTED] sentinel may still exist (if crash before step 3)
- On restart: `cleanupStaleSessions` checks meta.json status — sees "done", so does NOT try to clean up. But SQLite still shows "running". **Permanent divergence**.

**If crash during step 6 (mid-bus-emission)**:
- Some subscribers have run, others haven't
- DbWriter may have updated SQLite, but DigestWriter may not have
- **Partial state**: some writes committed, some lost, no way to tell which

### Scenario G: Context.md write fails (ContextUpdater)

**Location**: `createContextUpdater()` (session-subscribers.ts:17-44)

**What happens**: 
1. Entire handler is in a try-catch that swallows all errors (`catch { /* best-effort */ }`)
2. If `readFileSync` fails, `content` starts empty — existing context lines would be lost if the write succeeds
3. If `writeFileSync` fails, context updates are silently dropped

**Blast radius**: **LOW** for write failure (context_updates lost). But there's a subtle bug: if `readFileSync` fails but `writeFileSync` succeeds, the context.md file gets **overwritten with only the new updates**, losing all existing content. This is a **silent data destruction** scenario (not just data loss).

**Specific code path**:
```typescript
let content = "";
try {
  content = readFileSync(contextPath, "utf-8");  // fails → content = ""
} catch { /* file doesn't exist yet */ }
// ... applies updates to empty string ...
writeFileSync(contextPath, content);  // writes just the new updates, overwriting everything
```

## 2. EventBus Error Isolation — Verified

The EventBus emit() method (event-bus.ts:131-138):
```typescript
emit(event: AgentEvent): void {
  for (const fn of this.subscribers) {
    try {
      fn(event);
    } catch {
      /* subscriber errors never break the bus */
    }
  }
}
```

**Key properties**:
- ✅ Each subscriber is called in its own try-catch
- ✅ A throw from subscriber N does not prevent subscriber N+1 from running
- ⚠️ The catch is completely silent — no logging at all
- ⚠️ The error is swallowed with zero diagnostic information
- ⚠️ Subscriber order depends on registration order (array push), which means the order of side effects is implicit and fragile

**However**: The DbWriter handler has its OWN try-catch that logs the error. So if DbWriter throws, you'd see `[db-writer] Error persisting...` from DbWriter's catch, OR the bus's silent catch if DbWriter's catch itself throws (unlikely but possible).

## 3. Atomicity Assessment

### Are meta.json and SQLite writes atomic?

**No.** They are completely independent:
1. meta.json is written synchronously in `handleCompletionInner()` (line 790)
2. SQLite is written asynchronously via EventBus `session_end` emission (line 816)
3. There is **no transaction** spanning both writes
4. There is **no reconciliation** that detects or fixes divergence

### Is the SQLite write itself atomic?

**Partially.** Each `db.run()` call is its own implicit transaction (SQLite auto-commit mode). But `session_end` triggers MULTIPLE SQLite writes across different subscribers:
- DbWriter: `UPDATE sessions ...` 
- DigestWriter: `INSERT INTO session_digests ...`
- RequestTracker: `SELECT + UPDATE requests ...` (multiple statements)

Each of these is a separate transaction. If the process crashes after DbWriter commits but before RequestTracker commits, SQLite data is internally consistent per-table but cross-table state is partial.

### Is meta.json write itself atomic?

**Yes.** `writeSessionMeta` uses the `.tmp` + `renameSync` pattern (persistence.ts:174-176):
```typescript
const tmpPath = filePath + ".tmp";
writeFileSync(tmpPath, JSON.stringify(meta, null, 2), "utf-8");
renameSync(tmpPath, filePath);
```
On POSIX, `rename()` is atomic. So meta.json is always either the old version or the new version, never partially written.

### Is session.jsonl write atomic?

**No.** `appendFileSync` can partially write a line if the process crashes or disk runs out mid-write. On restart, the last line in the JSONL could be truncated JSON. The `readJsonlFile` parser handles this gracefully by skipping unparseable lines (persistence.ts:84-88):
```typescript
try {
  items.push(JSON.parse(line) as T);
} catch {
  log("warn", `[persistence:jsonl] Skipping corrupted JSONL line in ${filePath}`);
}
```
This is **correct** — truncated writes are tolerated. But the lost message is silently dropped.

## 4. Consistency Check / Reconciliation

**There is none.** No code anywhere compares meta.json status to SQLite status.

- `cleanupStaleSessions()` reads meta.json and checks [STARTED] sentinels. It does NOT check SQLite.
- The DB is never "healed" from meta.json after a crash
- `loadAllSessionMetas()` reads ONLY from meta.json, NEVER cross-references SQLite

**Impact**: After any crash, meta.json and SQLite can permanently diverge. The only way to fix it is manual intervention or a reconciliation script.

## 5. Risk Matrix

| Scenario | Severity | Likelihood | Detection | Recovery |
|---|---|---|---|---|
| A: meta.json write fails | **Critical** — all downstream writes skip | Low (disk full) | None (silent) | Restart finds stale meta.json |
| B: SQLite write fails | **Medium** — DB stale, meta.json correct | Low | console.error logged | None — permanent divergence |
| C: Digest write fails | **Low** — missing entry | Very low | log("warn") | Self-heals (missing entry is just missing) |
| D: Request tracker fails | **Low** — stale request status | Very low | None (swallowed) | Manual or eventual timeout |
| E: JSONL append fails | **Medium** — message data lost | Low | None (throws into agent event handler) | Truncated lines skipped on read |
| F: Process crash mid-completion | **High** — partial state | Medium (OOM, SIGKILL) | None | cleanupStaleSessions partially handles |
| G: Context.md overwrite on read fail | **Medium** — silent data destruction | Very low | None (swallowed) | Gone — no backup |

## 6. Proposed Fixes (Ranked by Severity)

### Fix 1: Wrap meta.json write in try-catch in handleCompletionInner [P0]

**File**: `src/lib/manager.ts`, line 790  
**Problem**: If `updateSessionStatus` throws, the bus event never fires, creating total downstream blackout.  
**Fix**: Wrap the meta.json write in try-catch so the bus event fires even if meta.json fails.

```typescript
// Current (line 790):
this.registry.updateSessionStatus(session.sessionId, outcome.archiveStatus, session.error);

// Proposed:
try {
  this.registry.updateSessionStatus(session.sessionId, outcome.archiveStatus, session.error);
} catch (err) {
  log("error", `[completion] Failed to write meta.json for ${session.sessionId}: ${err}`);
  // Continue — still emit session_end so DB and other subscribers fire
}
```

**Impact**: Prevents total write blackout. Meta.json may be stale, but SQLite and digests still update.

### Fix 2: Add try-catch around appendSessionMessage [P1]

**File**: `src/lib/manager.ts`, line 281  
**Problem**: JSONL write failure propagates into agent event handler with unknown consequences.  
**Fix**:

```typescript
// Current (line 280-281):
if (event.type === "message_end") {
  appendSessionMessage(persistDir, sessionId, event.message);

// Proposed:
if (event.type === "message_end") {
  try {
    appendSessionMessage(persistDir, sessionId, event.message);
  } catch (err) {
    log("error", `[persistence] Failed to append message for ${sessionId}: ${err}`);
  }
```

**Impact**: Prevents message persistence failures from affecting the running session. The message is lost from transcript but the session continues normally.

### Fix 3: Guard ContextUpdater against read failure [P1]

**File**: `src/lib/session-subscribers.ts`, lines 29-33  
**Problem**: If `readFileSync` fails for a reason other than "file doesn't exist" (e.g., permissions), the existing content is lost and overwritten.  
**Fix**: Only proceed with write if the read succeeded or the file genuinely doesn't exist.

```typescript
// Current:
let content = "";
try {
  content = readFileSync(contextPath, "utf-8");
} catch { /* file doesn't exist yet */ }

// Proposed:
let content = "";
let readFailed = false;
try {
  content = readFileSync(contextPath, "utf-8");
} catch (err: any) {
  if (err?.code !== 'ENOENT') {
    readFailed = true;
    log("warn", `[context-updater] Failed to read ${contextPath}: ${err}`);
  }
}
if (readFailed) return; // Don't overwrite with partial data
```

### Fix 4: Log errors in EventBus catch [P2]

**File**: `src/app/event-bus.ts`, line 135  
**Problem**: Subscriber errors are silently swallowed — impossible to diagnose.  
**Fix**:

```typescript
// Current:
catch {
  /* subscriber errors never break the bus */
}

// Proposed:
catch (err) {
  try { console.error("[event-bus] Subscriber error:", err); } catch { /* truly last resort */ }
}
```

**Impact**: Diagnostic-only. No behavioral change, but makes failures visible.

### Fix 5: Add lightweight reconciliation on startup [P2]

**Problem**: After crash, meta.json and SQLite can permanently diverge.  
**Fix**: In `cleanupStaleSessions()`, after processing meta.json, compare with SQLite and fix divergences:

```typescript
// After existing cleanup logic:
const dbSessions = db.prepare("SELECT sessionId, status FROM sessions WHERE status = 'running'").all();
for (const dbSession of dbSessions) {
  const meta = readSessionMeta(persistDir, dbSession.sessionId);
  if (meta && meta.status !== 'running') {
    // meta.json was updated but DB wasn't — sync DB from meta.json
    updateSessionDb(persistDir, dbSession.sessionId, { status: meta.status, error: meta.error });
  }
}
```

**Impact**: Heals the most common divergence pattern (Scenario F above).

## 7. Architecture Observation

The root cause of all these issues is the **fire-and-forget bus pattern** combined with **no transactional coordination**:

```
meta.json write ──(sync)──► bus.emit() ──(sync, isolated)──► DbWriter
                                                            ├► DigestWriter
                                                            ├► RequestTracker
                                                            ├► ContextUpdater
                                                            └► AutoResume
```

Each arrow is an independent failure domain. The bus provides **fault isolation** (subscriber A can't kill subscriber B) but **no fault coordination** (if the meta.json write succeeds but DbWriter fails, there's no rollback or retry).

For a system where meta.json is planned for removal (see audit-persistence-write-path.md P2), the right trajectory is:
1. **Short-term** (Fix 1-4): Add try-catch around the unprotected writes to prevent cascading failures
2. **Medium-term** (Fix 5): Add startup reconciliation to heal crash divergences  
3. **Long-term**: Eliminate meta.json entirely → SQLite becomes sole write target → single transaction per session lifecycle event → no divergence possible

## Verdict

The persistence layer is **resilient within the EventBus** (subscriber isolation works correctly) but **fragile outside it** (meta.json writes are unprotected and their failure prevents all downstream writes). The most dangerous scenario is a disk-full condition during completion, which silently creates a zombie session with stale state across all stores.

**Immediate priority**: Fix 1 (try-catch around meta.json write in completion pipeline) prevents the worst cascade. Fix 2-3 prevent silent data loss in message persistence and context updates.


[SIG: 1775933683:c28f4f19]
