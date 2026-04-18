# Implementation Plan: Unified Request Tracking

**Source**: `docs/design/request-tracking.md` (Hao's design)
**Bob Review**: `agents/bob/workspace/review-request-tracking.md`
**Author**: Tech Lead
**Date**: 2026-03-17

---

## Overview

Replace 4 JSONL tracking files + handoff tool + SIGNALS.md with:
- 1 SQLite database (`requests.db`) via `bun:sqlite`
- Merged `send()` that absorbs handoff's artifact delivery
- Audit cron job for completion reconciliation

## Phase Plan

### Phase 1: Core Module (requests.ts) — New File

**File**: `src/lib/requests.ts` (~120 lines)

Creates and manages `.state/requests.db` via `bun:sqlite`.

```typescript
// Key exports:
getDb(persistDir): Database               // Lazy init, WAL mode, schema migration
trackRequest(persistDir, opts): string     // INSERT, returns requestId
updateRequest(persistDir, reqId, update)   // UPDATE status/summary/error
getActiveRequests(persistDir): RequestRecord[]     // WHERE status IN ('CREATED','IN_PROGRESS')
getRequestsByAgent(persistDir, agent): RequestRecord[]
getRequestTree(persistDir, reqId): RequestRecord[] // WITH RECURSIVE CTE
getStaleRequests(persistDir, maxAgeMs): RequestRecord[]
isDuplicate(persistDir, from, to, taskHash): boolean
archiveOld(persistDir, maxAgeDays): number
```

**Schema**: As specified in design doc. One `requests` table with indexes on status, toAgent, parentRequestId, createdAt.

**Risk**: `bun:sqlite` is well-proven in our runtime. Main risk is ensuring WAL mode handles concurrent writes from multiple sessions. Mitigation: `PRAGMA busy_timeout = 5000` (already in design).

**Testing strategy**: Unit tests for all exported functions using temp DB files. ~15 test cases covering CRUD, dedup, tree queries, archival.

### Phase 2: Wiring — Mechanical Changes

#### 2a. `src/app/chat-session.ts` (~10 line change)

**Current**: Imports `logOrder()` from `orders.ts`, calls it at lines 133 and 297.
**Change**: Replace `logOrder()` calls with `trackRequest()`. Map: `source → fromEntity`, `assignedTo → toAgent`, `text → task`, `method: "chat"`.

```diff
- import { logOrder } from "../lib/orders.js";
+ import { trackRequest } from "../lib/requests.js";
```

At both call sites:
```diff
- logOrder(this.persistDir, { text, assignedTo: agent, source: "console", sessionId })
+ trackRequest(this.persistDir, { fromEntity: "human", toAgent: agent, task: text, method: "chat", sessionId })
```

#### 2b. `src/lib/manager.ts` — handleCompletion (~15 line change)

**Current** (lines 637-660):
- Calls `logRecoveryNeeded()` on error
- Calls `updateOrderStatus()` for order tracking
- Calls `logDelegation()` for send/call tracking

**Change**: Replace all three with `updateRequest()`.

```diff
- logRecoveryNeeded(this.registry.persistDir, { ... });
- updateOrderStatus(this.registry.persistDir, session.orderId, { status: "FAILED", error });
+ updateRequest(this.registry.persistDir, session.requestId, {
+   status: "FAILED", error, errorClass: classifyError(error), durationMs
+ });
```

**Note**: `classifyError()` stays — it's pure logic. It moves from `session-recovery.ts` into `requests.ts` (or stays as a standalone export).

#### 2c. `src/lib/manager.ts` — callAgent (~5 line change) ✅ DONE (via 2d)

**Status**: Implemented in `manager-agents-tool.ts` (commit 9e96ba6). The call action now tracks requests before calling and updates with outcome after. Done at the tool level rather than manager.ts to avoid touching manager internals.

#### 2d. `src/lib/manager-agents-tool.ts` — send case (~25 line change) ✅ DONE

**Status**: Implemented in commit 9e96ba6. Both send and call actions wired:
- **call**: trackRequest() before callAgent(), updateRequest() after with COMPLETED/FAILED, durationMs, errorClass
- **send**: isDuplicate() dedup check, trackRequest() with method "send", [req:shortId] tag in todo.md
- All tracking non-fatal (try/catch), lazy import for vitest compat
- 104 test files / 1401 tests pass
+ session.requestId = requestId;
```

#### 2d. `src/lib/manager-agents-tool.ts` — send case (~25 line change)

**Current** (lines 192-242): Writes to todo.md, triggers heartbeat, logs delegation.
**Change**:
1. Add `trackRequest()` call with `method: "send"`
2. Include `[req:requestId]` tag in the todo.md entry
3. Add optional `artifact`, `context`, `expectations`, `notify` fields to schema
4. If `artifact` provided, validate file exists (from handoff-tool.ts logic)
5. If `notify` array provided, write FYI entries to those agents' todo.md
6. Replace `logDelegation()` with the DB track

**Schema update** — extend `agentsToolParams`:
```typescript
artifact: Type.Optional(Type.String({ description: "Path to artifact file (validated)" })),
context: Type.Optional(Type.String({ description: "Context for the delivery" })),
expectations: Type.Optional(Type.String({ description: "What receiver should do" })),
notify: Type.Optional(Type.Array(Type.String(), { description: "FYI agents (get todo entry, no request)" })),
```

**Dedup**: `isDuplicate(persistDir, from, to, hash(message))` before writing.

#### 2e. `src/lib/tools/lifecycle.ts` — finish() (~10 line change)

**Current** (lines 146-168): Writes structured JSON to `session-outcomes.jsonl`.
**Change**: Replace with `updateRequest()` using session's `requestId`.

```diff
- appendFileSync(outcomesPath, JSON.stringify(outcome) + "\n");
+ updateRequest(persistDir, session.requestId, {
+   status: params.status === "success" ? "COMPLETED" : params.status === "failure" ? "FAILED" : "BLOCKED",
+   summary: params.summary, completedAt: Date.now()
+ });
```

### Phase 3: Handoff Backward Compatibility (Bob's recommendation) ✅ DONE

**Completed**: 2026-03-17 (commit 1cfdf23)
**Approach**: Dual-write — handoff-tool.ts now writes to both SIGNALS.md (existing) and SQLite request DB (new).
- 3a: Added lazy import for requests.ts, `trackRequest()` call with artifact/context/expectations
- 3a: Added `persistDir` to `HandoffToolOptions` interface  
- 3a: Deprecation warning in return message
- 3b: `persistDir` wired through `agent-loader.ts` to `createHandoffTool`
- All 104 test files / 1401 tests pass
  artifact: params.artifact_path,
  context: params.context,
  expectations: params.expectations,
  notify: params.read_by?.filter(a => a !== params.target),
};
// Log deprecation warning
ctx.log(`⚠️ handoff() is deprecated — use send() with artifact field instead`);
// Call send logic
```

#### 3b. `src/app/agent-loader.ts` — Keep coordination case, add deprecation

Mark the `coordination` preset as deprecated in logs. After 1 week, remove it.

### Phase 4: New Cron Job — audit-requests.ts ✅ DONE

**Completed**: 2026-03-17 (commit 70de1e9)
**File**: `agents/may/handlers/audit-requests.ts` (95 lines)
**Test**: `test/audit-requests.bun-test.ts` (8 tests pass)
**Cron**: Registered in `agents/may/cron.json` with 1h interval

Hourly job that:
1. Finds `CREATED` requests older than 2h → log warning
2. Finds `IN_PROGRESS` requests older than 4h with no active session → reset to `CREATED`
3. Scans all agents' todo.md for checked `[req:xxx]` items → update matching requests to `COMPLETED`
4. Archives `COMPLETED`/`FAILED` requests older than 7 days

Register in May's cron: `{ handler: "audit-requests", interval: "1h" }`.

### Phase 5: CLI Status Tool (Bob's recommendation) ✅ DONE

**Completed**: 2026-03-17 (commit 149b35f)
**File**: `src/lib/tools/request-status.ts` (~90 lines)
**Test**: `test/request-status.bun-test.ts` (7 tests pass)

CLI tool (`bun src/app/may.ts --status`) that queries SQLite and prints:
- Active requests with task previews and age
- Stale requests (>2h old)
- Completion rates by agent (last 24h) with totals, done, failed, rate%, avg duration

Wired via `--status` flag in `may.ts` (early exit before main startup).

### Phase 6: Leaf Agent Send-Only Tool (Bob's recommendation) ✅ DONE

**Completed**: 2026-03-17 (commit 229d928)
**File**: `src/lib/tools/send-tool.ts` (~150 lines)

Lightweight tool for leaf agents (coder, evaluator, qa, amy-kimi) that can only `send()`:
- No `call`/`peek`/`cancel` capability (preserves hierarchy)
- Supports `artifact` field for delivery
- Dedup support via isDuplicate()
- Request tracking in SQLite
- Optional `allowedTargets` for restricting destinations
- Registered as `"send-only"` preset in agent-loader.ts

### Phase 7: Cleanup (1 week after Phase 3)

- Delete `src/lib/orders.ts` (211 lines)
- Delete `src/lib/session-recovery.ts` (216 lines) — keep `classifyError()` in requests.ts
- Delete `src/lib/tools/handoff-tool.ts` (288 lines)
- Remove `coordination` case from `agent-loader.ts`
- Remove `"coordination"` from all `agent.json` tool presets
- Freeze SIGNALS.md (rename to `SIGNALS.md.archived`)
- Remove SIGNALS.md steps from all heartbeats
- Update CONVENTIONS.md, common-sense.md, best-practices.md

---

## File-by-File Summary

| File | Action | Lines Changed | Phase |
|------|--------|---------------|-------|
| `src/lib/requests.ts` | NEW | ~120 | 1 |
| `src/app/chat-session.ts` | MODIFY | ~10 | 2a |
| `src/lib/manager.ts` (handleCompletion) | MODIFY | ~15 | 2b |
| `src/lib/manager.ts` (callAgent) | MODIFY | ~5 | 2c |
| `src/lib/manager-agents-tool.ts` | MODIFY | ~25 | 2d |
| `src/lib/tools/lifecycle.ts` | MODIFY | ~10 | 2e |
| `src/lib/tools/handoff-tool.ts` | MODIFY (deprecate) | ~20 | 3 |
| `src/app/agent-loader.ts` | MODIFY | ~5 | 3 |
| `agents/may/handlers/audit-requests.ts` | NEW | ~60 | 4 |
| `src/lib/tools/request-status.ts` | NEW | ~40 | 5 |
| `src/lib/tools/send-tool.ts` | NEW | ~30 | 6 |

**Net**: +250 new lines, ~715 lines eventually deleted = **~465 lines net reduction** + elimination of 8K-line SIGNALS.md.

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| SQLite concurrent access | Medium | WAL mode + busy_timeout. Single-process architecture limits contention. |
| Agent confusion during transition | Medium | 1-week deprecated alias for handoff. Phase code before docs. |
| `[req:xxx]` tag in todo.md causes agent confusion | Low | Tags are small, agents ignore unknown brackets. Test with 1 agent first. |
| Recovery data loss during migration | Low | Old JSONL files remain on disk. Dual-write for 24h in Phase 2. |
| Leaf agents calling `send()` to inappropriate targets | Low | Send-only tool can have target allowlist. |

---

## Testing Strategy

| Test File | Coverage | Phase |
|-----------|----------|-------|
| `test/requests.test.ts` | Core CRUD, dedup, tree, archival (~15 tests) | 1 |
| `test/chat-session.test.ts` | Verify trackRequest called on new chat | 2a |
| `test/manager.test.ts` | Verify updateRequest on completion/error | 2b-2c |
| `test/manager-agents-tool.test.ts` | send() with artifact, dedup, notify | 2d |
| `test/lifecycle.test.ts` | finish() updates request DB | 2e |
| `test/handoff-compat.test.ts` | Deprecated handoff still works | 3 |
| `test/handlers/audit-requests.test.ts` | Stale detection, checkbox reconciliation | 4 |

---

## Execution Order

1. **Phase 1**: Build `requests.ts` + tests (standalone, no integration)
2. **Phase 2**: Wire into existing code (dual-write: keep old JSONL writes for 24h)
3. **Phase 3**: Handoff backward compatibility
4. **Phase 4**: Audit cron job
5. **Phase 5-6**: CLI tool + leaf agent send-only (can happen in parallel)
6. **Phase 7**: Cleanup (1 week later)

Phases 1-3 are the critical path. Phases 4-6 are valuable but can ship independently.

---

## Open Questions for May/Bob

1. Should `requests.db` go in `.state/` (current JSONL location) or a new `.db/` directory?
2. Should we dual-write to old JSONL during transition, or cut over cleanly?
3. Should the audit job live in May's handlers or be a system-level cron?
4. Do we want request IDs visible to agents (in todo.md `[req:xxx]`) or hidden?
