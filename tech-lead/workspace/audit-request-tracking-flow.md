# Audit: Request Tracking End-to-End Flow

**Lens**: B (complexity audit)  
**Date**: 2026-04-13  
**Scope**: `src/tools/agents.ts` (message action) → `src/lib/requests.ts` → injection (cron.ts) → completion (session-subscribers.ts) → auto-close  
**Method**: Code trace with line-level evidence

---

## Flow Summary

```
agents.message() tool call
  → manager-agents-tool.ts:393-498  (validate + dedup + track + trigger)
     → requests.ts:trackRequest()   (INSERT into requests table, status=CREATED)
     → triggerHeartbeat()           (fast-forwards agent's cron timer)

cron.ts heartbeat fires
  → cron.ts:658-677                 (query pending requests, inject into task text)
     → raw SQL query on requests table (status IN CREATED/IN_PROGRESS)
     → formats as "<retrieved_state>" block in heartbeat task message

agent processes heartbeat, calls finish()
  → session-subscribers.ts:63-128  (createRequestTracker)
     → finished_items → fuzzy-match against pending requests → mark COMPLETED
     → new_items → trackRequest() for self-assigned follow-ups
```

**Total layers of indirection: 5** (tool handler → DB write → cron injection → agent processing → subscriber completion)

---

## Findings

### F-1: Dedup uses exact substring match, not semantic similarity — LOW

**Evidence**: `manager-agents-tool.ts:425-430`
```ts
const existingReqId = isDuplicate(
  manager.registry.persistDir,
  caller,
  params.agent,
  params.message.slice(0, 500),
);
```
Then `requests.ts:562-578`:
```ts
const row = db.prepare(
  `SELECT requestId FROM requests
   WHERE fromEntity = ? AND toAgent = ?
   AND task = ? AND status IN ('CREATED', 'IN_PROGRESS')
   LIMIT 1`
).get(fromEntity, toAgent, taskHash);
```

The dedup compares `task = ?` — exact string equality on the first 500 chars. Two semantically identical messages with different wording will both be inserted. This is acceptable for programmatic callers but fragile for LLM-generated messages.

**Impact**: Occasional duplicate requests in the DB. Low severity because heartbeat injection shows all pending items to the agent, who can deduplicate mentally.

---

### F-2: Completion fuzzy-match threshold is 0.3 — fragile — MEDIUM

**Evidence**: `session-subscribers.ts:102-117`
```ts
for (const item of finishParams.completed_items) {
  const needle = String(item).trim().toLowerCase();
  let bestId: string | null = null;
  let bestScore = 0;
  for (const req of pending) {
    const reqText = req.task.toLowerCase();
    const words = needle.split(/\s+/);
    const score = words.filter((w) => reqText.includes(w)).length / Math.max(words.length, 1);
    if (score > bestScore && score > 0.3) {
      bestScore = score;
      bestId = req.requestId;
    }
  }
  if (bestId) {
    updateRequest(persistDir, bestId, { status: "COMPLETED", ... });
  }
}
```

Problems:
1. **Word-inclusion scoring** — counts what fraction of needle words appear in the request text. Short common words ("fix", "the", "add") inflate scores. A 2-word completed_item like "fix bug" would match any request containing "fix" and "bug" regardless of context.
2. **0.3 threshold** — only 30% of words need to match. For a 10-word item, 3 matching common words could close the wrong request.
3. **Best-match wins** — if multiple requests score above 0.3, only the highest is marked COMPLETED. No confirmation, no logging of the match score.
4. **No false-positive guard** — a completed_item that doesn't correspond to any real request can still match a random request at 0.31 score and close it silently.

**Impact**: Wrong requests can be silently auto-closed. No observability into which request was matched or why.

---

### F-3: Pending request injection queries DB directly in cron.ts — duplicated SQL — LOW

**Evidence**: `cron.ts:660-667`
```ts
const pending = db
  .prepare(
    `SELECT task, fromEntity, createdAt, requestId FROM requests
     WHERE toAgent = ? AND status IN ('CREATED', 'IN_PROGRESS') AND method IN ('message', 'send', 'fork', 'run')
     ORDER BY createdAt ASC`
  )
  .all(agentName);
```

This raw SQL duplicates the logic in `requests.ts:getRequestsByAgentAndStatus()` but with different column selection and method filtering. The requests.ts function doesn't filter by method, while cron.ts adds `method IN ('message', 'send', 'fork', 'run')` — excluding 'chat' and 'workflow' methods.

The session-subscribers.ts completion query (line 96-99) uses the same method filter, so there's consistency between injection and completion. But if a new method is added, two raw SQL queries need updating instead of one function.

**Impact**: Maintenance burden only. Correctness is fine today.

---

### F-4: No status transition from CREATED → IN_PROGRESS for injected requests — MEDIUM

**Evidence**: `cron.ts:658-677` — Pending requests are queried and injected into the heartbeat task, but none of the injected request IDs are updated to IN_PROGRESS status afterward.

The heartbeat *itself* gets a request tracked (`cron.ts:635`: `updateRequest(this.persistDir, requestId, { status: "IN_PROGRESS" })`), but that's the heartbeat session's own request — not the pending task requests that were injected.

So a request stays CREATED even after being injected into 5+ heartbeats. The only transition is CREATED → COMPLETED (via fuzzy-match in finish()) or CREATED → COMPLETED/FAILED via manual `agents.requests` action.

**Impact**: The `getStaleRequests()` function (used by `agents.requests(filter='stale')`) will flag requests as stale even if they've been seen and are being worked on. No way to distinguish "never seen" from "seen but not yet done."

---

### F-5: Silent failure in every catch block — no observability — MEDIUM

**Evidence**: Throughout the flow, every error is swallowed:

- `manager-agents-tool.ts:443`: dedup failure → `catch { /* Non-fatal */ }`
- `manager-agents-tool.ts:475`: trackRequest failure → `catch { /* Non-fatal */ }`
- `cron.ts:678`: pending task injection → `catch { /* fall back silently */ }`
- `session-subscribers.ts:86-88`: new_items tracking → `catch { /* best-effort */ }`
- `session-subscribers.ts:125`: completed_items matching → `catch { /* best-effort */ }`

Count: **5 silent catch blocks** in the critical path. If the DB is corrupted, locked, or a schema migration fails, the entire request tracking system fails silently. Messages appear sent but aren't tracked. Completions aren't recorded. Agents see no pending tasks.

**Impact**: Total system blindness during DB issues. The sender gets `{ sent: true, requestId: undefined }` with no error indication.

---

### F-6: triggerHeartbeat is fire-and-forget — message delivery not guaranteed — LOW

**Evidence**: `manager-agents-tool.ts:478`
```ts
const triggered = triggerHeartbeat?.(params.agent) ?? false;
```

The `triggerHeartbeat` function (`agent-loader.ts:197-210`) fast-forwards the cron timer. If the agent already has a running heartbeat session, `triggerNow()` returns false and the message won't be processed until the next natural heartbeat cycle.

The `heartbeatTriggered: triggered` field is returned to the caller, so they know. But many callers ignore this field.

**Impact**: Messages can be delayed by up to one heartbeat interval (typically 30min). Acceptable for async messaging, but callers should be aware.

---

### F-7: `new_items` creates self-referencing requests with method='message' — QUIRK

**Evidence**: `session-subscribers.ts:74-85`
```ts
for (const item of finishParams.new_items) {
  trackRequest(persistDir, {
    fromEntity: event.agent,
    toAgent: event.agent,
    task: String(item).slice(0, 500),
    method: "message",
    source: "finish",
  });
}
```

When an agent calls `finish({ new_items: ["do X"] })`, it creates a request FROM the agent TO the same agent. This is intentional (self-assigned follow-up work) but:
- These requests have `method: "message"` even though no actual message was sent
- They're indistinguishable from inter-agent messages in DB queries
- The `source: "finish"` field distinguishes them, but no query filters on source

**Impact**: Minor. The DB accurately represents "this agent wants to do X" but the method field is misleading.

---

### F-8: archiveOld only cleans terminal requests — no cleanup for abandoned CREATED — LOW

**Evidence**: `requests.ts:583-593`
```ts
export function archiveOld(persistDir: string, maxAgeDays: number): number {
  const db = getDb(persistDir);
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const result = db.run(
    `DELETE FROM requests
     WHERE status IN ('COMPLETED', 'FAILED', 'BLOCKED')
     AND completedAt IS NOT NULL AND completedAt < ?`, [cutoff]
  );
  return result.changes;
}
```

Requests stuck in CREATED or IN_PROGRESS forever are never archived. `getStaleRequests()` can find them, but nothing calls archiveOld on active statuses. Over time, the pending requests list grows unboundedly.

**Impact**: Heartbeat injection will include increasingly stale tasks. Agent sees 50 items from months ago. Token waste grows linearly.

---

## Architecture Diagram

```
  Sender Agent                     DB (requests table)              Recipient Agent
  ───────────                      ─────────────────                ────────────────
       │                                  │                               │
  agents.message()                        │                               │
       │──── isDuplicate() ──────────────→│ (exact string check)          │
       │                                  │                               │
       │──── trackRequest() ────────────→│ INSERT status=CREATED          │
       │                                  │                               │
       │──── triggerHeartbeat() ──────────│─────────── fast-forward cron──→│
       │                                  │                               │
       │  (return to sender)              │    cron.ts fireHeartbeat()    │
       │                                  │←── raw SQL query ────────────│
       │                                  │                               │
       │                                  │    inject as <retrieved_state>│
       │                                  │───────────────────────────────→│
       │                                  │                               │
       │                                  │    agent calls finish()       │
       │                                  │←──── fuzzy-match 0.3 ────────│
       │                                  │ UPDATE status=COMPLETED       │
       │                                  │                               │
```

---

## Severity Summary

| ID  | Finding | Severity |
|-----|---------|----------|
| F-1 | Dedup uses exact string match | LOW |
| F-2 | Fuzzy-match completion at 0.3 threshold | **MEDIUM** |
| F-3 | Duplicated SQL between cron.ts and requests.ts | LOW |
| F-4 | No CREATED→IN_PROGRESS transition on injection | **MEDIUM** |
| F-5 | 5 silent catch blocks — no observability | **MEDIUM** |
| F-6 | triggerHeartbeat fire-and-forget | LOW |
| F-7 | new_items creates self-referencing requests with wrong method | LOW/QUIRK |
| F-8 | No cleanup for abandoned CREATED requests | LOW |

**Overall complexity assessment**: The flow is reasonably linear (5 hops) but has **3 medium-severity gaps** that could cause silent data corruption (F-2), misleading status (F-4), and total blindness during failures (F-5). The fuzzy-match completion (F-2) is the highest-risk item — it can close wrong requests with no logging.
