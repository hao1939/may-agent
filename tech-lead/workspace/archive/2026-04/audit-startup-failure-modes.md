# Audit: Session Startup Failure Modes

**Lens D (Fragility) — 2026-04-11**
**Scope**: Trace the session startup path and identify what happens when each layer fails.

## Startup Path (9 Layers)

The full path from cron tick to first LLM token:

```
L1: Cron timer fires (cron.ts startEntry → fire())
L2: Auto-pause check (getAutoPauseState, isAgentHeartbeatRunning)
L3: Request tracking (trackRequest, updateRequest → may.db)
L4: Context injection (heartbeat.md, pending tasks, interrupted session)
L5: manager.run() — session directory creation, Agent construction
L6: Registry persistence (saveSession → meta.json)
L7: Event bridging + bus subscribers (session_start event)
L8: buildSessionContext() — digest DB, active recall, checkpoint, context.md
L9: runAgentWithRetry → gatedPrompt → agent.prompt() (LLM call)
```

---

## Layer-by-Layer Failure Analysis

### L1: Cron Timer (startEntry → fire())

**What can fail**: The cron config JSON can't parse, or `resolveMode()` returns null.

**What happens**: 
- Parse failure: `load()` catches error, logs via `onError`, returns existing entries (fail-open). No session started.
- No handler/agent: `resolveMode()` logs warning, returns null. `startEntry()` exits early.
- Timer itself crashes: The `fire()` closure is wrapped in the interval. Unhandled throw would kill the timer but NOT crash the process (interval callbacks don't propagate). That timer would be dead — **silent loss of one cron job until restart**.

**Ghost session risk**: None. No session is created at this layer.

**Verdict**: ✅ Safe. Failures are pre-session.

---

### L2: Auto-Pause Check

**What can fail**: `getAutoPauseState()` reads from may.db via `getDb()`.

**What happens**:
- DB query failure: `getAutoPauseState` (in auto-pause.ts) is called directly — if it throws, the exception propagates up through `fire()`. The interval callback catches this silently (see L1). The heartbeat just doesn't fire.
- `isAgentHeartbeatRunning()` has its own try-catch that returns `false` on error (fail-open). This means: if the DB is down, the overlap check passes and the heartbeat fires normally.

**Inconsistency**: `isAgentHeartbeatRunning()` is fail-open but `getAutoPauseState()` can throw. If auto-pause DB queries fail, the heartbeat is skipped silently.

**Ghost session risk**: None.

**Verdict**: ⚠️ Minor. Auto-pause should have a try-catch like the overlap check (fail-open). Currently a DB hiccup silently skips heartbeats.

---

### L3: Request Tracking (trackRequest → may.db)

**What can fail**: `trackRequest()` and `updateRequest()` write to SQLite.

**What happens**: 
- `trackRequest()` is called **before** `manager.run()`. If it throws, the catch block in `fireHeartbeat()` catches it, updates the request to FAILED, and logs. But wait — if `trackRequest()` itself failed, the request was never created, so `updateRequest()` in the catch block would also fail. The inner `updateRequest` call would be a no-op (the request ID doesn't exist).
- Net effect: Heartbeat doesn't fire. The `onError` callback logs it. Next interval tick will try again.

**Ghost session risk**: None. Session not yet created.

**Verdict**: ✅ Safe. Pre-session failure, logged.

---

### L4: Context Injection (heartbeat.md, pending tasks, interrupted session)

**What can fail**: File reads (heartbeat.md), DB queries (pending tasks, last interrupted session).

**What happens**:
- `heartbeat.md` read: wrapped in try-catch inside the injection block. If the file doesn't exist or can't be read, that injection is skipped silently. Other injections still work.
- Pending tasks DB query: wrapped in its own try-catch. Falls back silently.
- Last interrupted session query: wrapped in its own try-catch. Falls back silently.
- Outer try-catch covers the entire agent directory resolution.

**Ghost session risk**: None. Session not yet created.

**Verdict**: ✅ Well-defended. Every injection has independent try-catch. Partial context injection is graceful degradation, not failure.

---

### L5: manager.run() — Session Creation

**What can fail**: 
1. Agent not registered → `throw new Error("Agent not registered")`
2. `generateId()` generates duplicate → `throw new Error("Session already active")`
3. `ensureSessionDir()` / `mkdirSync()` fails (disk full, permissions)
4. `createAgent()` fails (tool wiring, undefined parameters)
5. `writeFileSync` for [STARTED] sentinel fails
6. `subscribeForPersistence()` fails

**What happens**:
- Items 1-4: These throw before the session is added to `activeSessions`. The exception propagates up to `fireHeartbeat()` which catches it, marks the request as FAILED, and logs. **No ghost session**.
- Item 5: [STARTED] sentinel write is wrapped in try-catch — best-effort, no throw.
- Item 6: `subscribeForPersistence()` calls `session.agent.subscribe()`. If this throws, it propagates up. At this point the session is NOT yet in `activeSessions` (that happens at line ~996), so no ghost.

**BUT there's a critical gap**: The session is added to `activeSessions` (line ~999) BEFORE `buildSessionContext()` and `agent.prompt()`. If `buildSessionContext()` throws (unlikely, covered in L8), or if the `gatedPrompt()` promise rejects synchronously before `runAgentWithRetry` gets it, the session IS in `activeSessions` and has a `session.promise` that resolves immediately.

Actually, looking more carefully: `session.promise = runAgentWithRetry(...)` is set AFTER `activeSessions.set()`. The `runAgentWithRetry` function runs the initial `agent.prompt()` call and handles errors by setting `session.error`, then calls `onComplete` → `handleCompletion()`. So any throw from the LLM layer flows through to `handleCompletion()` which archives the session properly.

**Ghost session risk**: ⚠️ **Theoretical edge case**: If `buildSessionContext()` at line 1018 throws, it happens AFTER `this.activeSessions.set(sessionId, session)` at line 999. The throw would propagate up from `run()` to `fireHeartbeat()`. The session is now stuck in `activeSessions` with no `session.promise` set. `waitFor()` would never resolve. The session would be a ghost.

Let me verify the exact ordering:

```
L960:  this.subscribeForPersistence(session);
L968:  this.registry.saveSession(...)  // writes meta.json with status: "running"
L993:  this.setupTimeout(session, def.timeoutMs);
L996:  this.activeSessions.set(sessionId, session);  // ← NOW IN ACTIVE MAP
L998:  this.bridgeAgentEvents(name, sessionId);
L1005: this.emit({ type: "session_start", ... });
L1018: const sessionContext = this.buildSessionContext(...);  // ← CAN THROW?
L1034: session.promise = runAgentWithRetry(...);
L1040: this.sessionResults.set(sessionId, ...);
```

If L1018 throws, the session is in `activeSessions` with `promise: null!` (the initial assignment). This is a **ghost session**: it's marked "running" in meta.json, present in `activeSessions`, but will never complete. The timeout (if configured) would eventually fire and cancel it. Otherwise: **permanent ghost until restart**.

**Verdict**: 🔴 **Critical gap**. `activeSessions.set()` should happen AFTER `buildSessionContext()`, or `buildSessionContext()` needs a top-level try-catch.

---

### L6: Registry Persistence (saveSession → meta.json)

**What can fail**: `writeSessionMeta()` does `writeFileSync()` to `sessions/<id>/meta.json`.

**What happens**: 
- `this.registry.saveSession()` is called at line ~968, BEFORE `activeSessions.set()`. If it throws, the session directory exists (from `ensureSessionDir`) but has no meta.json.
- The throw propagates up to `fireHeartbeat()` catch block. No session in activeSessions. 
- **But**: `ensureSessionDir` already created the directory. The empty directory stays on disk. `resumeStaleSessions()` won't find it (no meta.json to read). `cleanupZombieSessions()` won't clean it (it reads meta.json via `readSessionMeta`).

**Ghost session risk**: No ghost in memory. Orphan directory on disk (negligible).

**Verdict**: ✅ Safe. Minor disk clutter.

---

### L7: Event Bus Subscribers (session_start)

**What can fail**: `this.emit({ type: "session_start", ... })` dispatches to all bus subscribers.

**What happens**:
- Two subscribers react to `session_start`: `createStuckDetector` (initializes state map) and `createDigestWriter` (creates start digest in DB).
- If `createDigestWriter` throws: it has internal try-catch (`try { createStartDigest(...) } catch { /* best-effort */ }`). Safe.
- If `createStuckDetector` throws: `state.set()` is just a Map operation — extremely unlikely to throw.
- The `emit()` method itself: if the EventBus catches subscriber errors, this is safe. Let me check...

The EventBus `emit()` dispatches to each subscriber. If a subscriber throws, it depends on whether the bus catches it. Looking at the code pattern — the session_start event is emitted on line 1005, AFTER `activeSessions.set()`. If a subscriber throw propagates and kills `run()`, we'd have the same ghost session problem as L5.

**Ghost session risk**: Same as L5 — depends on whether `emit()` is try-catch protected.

**Verdict**: ⚠️ Depends on EventBus error handling. If `emit()` lets subscriber exceptions propagate, a buggy subscriber could create a ghost session.

---

### L8: buildSessionContext() — Digest DB, Active Recall, Checkpoint

**What can fail**:
1. `getRecentDigests()` — DB query
2. `getCrossAgentDigests()` — DB query
3. `getUnresolvedDigests()` — DB query
4. `formatDigestContext()` — string formatting
5. `runActiveRecall()` — file reads
6. `readLatestCheckpointForAgent()` — file reads
7. `readFileSync(contextFiles)` — file reads
8. `readFileSync(context.md)` — file read
9. `routeKnowledge()` — file reads + matching

**What happens**:
- Items 1-3: Wrapped in a single try-catch: `try { ... } catch { /* DB not available */ }`. If any of these throw, the entire digest block is skipped. **Safe**.
- Item 5 (`runActiveRecall`): Called directly without try-catch in `buildSessionContext()`. If it throws, the entire function throws.
- Item 6 (`readLatestCheckpointForAgent`): Called directly. If it throws, the function throws.
- Items 7-8: File reads wrapped in `if (existsSync(...))` but no try-catch around `readFileSync`. Race condition: file deleted between check and read → throw.
- Item 9 (`routeKnowledge`): Called directly. If it throws, the function throws.

**Ghost session risk**: 🔴 **Yes**. As established in L5, `buildSessionContext()` throwing creates a ghost session because `activeSessions.set()` already happened.

**Specific trigger**: `runActiveRecall()` or `readLatestCheckpointForAgent()` or `routeKnowledge()` throwing would create a ghost session stuck in "running" forever (until timeout or restart).

**Verdict**: 🔴 **Multiple unprotected function calls in buildSessionContext()**. The digest/DB block is wrapped, but active recall, checkpoint reading, context.md reading, and knowledge routing are all unprotected.

---

### L9: LLM Call (runAgentWithRetry → gatedPrompt → agent.prompt)

**What can fail**:
1. `gatedPrompt()` — API gate acquire fails
2. `agent.prompt()` — network error, auth error, model not found
3. Rate limiting (429)
4. Empty response / stream corruption

**What happens**:
- `gatedPrompt()`: wraps `callFn()` in `apiGate.acquire().then(release => callFn().finally(release))`. If acquire rejects (e.g., abort signal), the promise rejects. `runAgentWithRetry` catches this via `try { await initialCall } catch { session.error = ... }`.
- Network errors: Caught by `runAgentWithRetry`, classified by `isRetryableInfraError()`. HTTP errors (429, 502, 503, 500, ECONNRESET, etc.) get exponential backoff retry up to `infraRetryMax` (default: what?).
- Auth errors (401, 403): NOT in the retryable list → fall through to `onComplete()` → `handleCompletion()` → session ends with error status.
- Empty response: Retried up to `infraRetryMax` times with backoff.
- Provider outage: Retried with 15s+ base delay.

After all retries exhausted: `onComplete(session)` → `handleCompletion()` → session is properly archived. The session is removed from `activeSessions`.

**Ghost session risk**: None for LLM errors. The `runAgentWithRetry` → `handleCompletion` path always cleans up.

**Verdict**: ✅ Well-defended. Comprehensive retry logic with proper cleanup on exhaustion. The retry patterns cover the major transient error classes.

---

## Summary of Findings

### 🔴 Critical: Ghost Session from buildSessionContext() Throw

**Location**: manager.ts run(), lines ~996-1018

**Problem**: `activeSessions.set()` happens at line ~996. `buildSessionContext()` at line ~1018 has several unprotected function calls (`runActiveRecall`, `readLatestCheckpointForAgent`, `routeKnowledge`, context.md file read). If any of these throw, the session is in `activeSessions` with `promise: null!`, status "running" in meta.json, and will never complete.

**Impact**: 
- Ghost session blocks future heartbeats via overlap check (`isAgentHeartbeatRunning` → finds running request)
- `waitFor()` on this session blocks forever
- Session stays in `activeSessions` until process restart
- On restart, `resumeStaleSessions()` would pick it up and either resume (replay an empty JSONL → re-prompt) or mark interrupted

**Mitigation already present**: Session timeout (if configured) would eventually fire `cancel()`. But not all agents have timeouts configured.

**Fix options**:
1. **Move `activeSessions.set()` after `buildSessionContext()` and the `session.promise` assignment** — ensures the session only appears in the active map once it's fully wired
2. **Wrap `buildSessionContext()` in try-catch** — on failure, archive the session immediately and remove from activeSessions
3. **Add try-catches inside `buildSessionContext()`** for each unprotected block (active recall, checkpoint, knowledge routing, context files)

**Recommended**: Option 3 (defensive, consistent with how the digest block is already handled) + Option 2 as safety net.

### ⚠️ Minor: Auto-Pause DB Query Can Skip Heartbeat Silently

**Location**: cron.ts fire(), auto-pause check

**Problem**: `getAutoPauseState()` can throw on DB error, which silently skips the heartbeat (caught by the interval callback). `isAgentHeartbeatRunning()` is fail-open (has its own try-catch) but auto-pause is not.

**Fix**: Wrap `getAutoPauseState()` call in try-catch with fail-open default (treat as "running" state → fire normally).

### ⚠️ Minor: Cron Timer Death is Silent

**Location**: cron.ts startEntry() → fire() closure

**Problem**: If `fire()` throws an unhandled error (not caught by inner try-catches), the interval callback swallows it but continues. However, if the interval itself is killed by an uncaught throw in the timer callback, that specific cron job is dead until reload/restart.

**Fix**: Add a top-level try-catch inside the `fire()` closure.

### ✅ Strong: Everything After agent.prompt()

The `runAgentWithRetry` → `handleCompletion` path is robust:
- Infra errors get exponential backoff retry
- Rate limits get 15s+ base delay
- `handleCompletion` has outer try-catch that always cleans up (Bug 3 fix)
- `activeSessions.delete()` always runs in both happy and error paths
- Stuck detector watches for error loops and cancels

### ✅ Strong: Pre-Session Layers (L1-L4)

Cron → auto-pause → request tracking → context injection all fail before any session object exists. No ghost sessions possible.

---

## Comparison with Completion Path SPOF

Prior Lens audits found the completion path has a **meta.json write SPOF** — if meta.json write fails in the completion pipeline, all downstream bus subscribers are blocked.

The startup path has a different SPOF pattern: **the ordering gap between `activeSessions.set()` and the first successful LLM call**. During this window (L5-L8), a throw creates a ghost session. This is smaller than the completion SPOF (the completion SPOF affects every session end; the startup SPOF requires a rare throw from active recall / checkpoint / knowledge routing) but it's still a real gap.

The fundamental fix is the same principle: **don't register a session as "running" until all setup is complete**, just as the completion fix should **not rely on a single meta.json write for all downstream processing**.
