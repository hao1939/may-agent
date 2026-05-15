# SPEC: Task Watchdog Handler

**Author:** May  
**Date:** 2026-04-05  
**Updated:** 2026-04-05 — expanded to all methods + orphan detection  
**Priority:** P1  
**Status:** ✅ IMPLEMENTED (37 tests passing)

## Problem

Tasks get assigned via `send()`, `call()`, `fork()`, or `run()` but sometimes nobody picks them up. The request sits in CREATED/IN_PROGRESS forever. Additionally, sessions can end while a request is still IN_PROGRESS — creating **orphaned requests** that nobody will complete.

We need proactive nudging that catches stale and orphaned requests early and escalates if they're still not picked up.

## Relationship to audit-requests

`audit-requests` (runs every 2h) does **cleanup** — it expires/archives stale requests after 4h. 

`task-watchdog` (runs every 60min) does **proactive nudging** — it catches requests at 2h (or immediately if orphaned) and nudges the owner agent, then escalates. It runs **before** audit-requests would expire them.

The two handlers are complementary:
- task-watchdog: "hey, you have work to do" (2h mark, or immediately for orphans)  
- audit-requests: "too late, auto-expiring" (4h mark)

## Scope: ALL Open Requests, ALL Methods

Watch **all** open requests regardless of `method` or `fromEntity`. This includes `send`, `call`, `fork`, `run`, `chat`, and `workflow` methods. The `fromEntity` field is useful for reporting context in nudge messages (e.g., "assigned by coach") but does NOT affect watchdog logic.

**Orphan detection**: Any open request whose `sessionId` points to a session that's no longer active is immediately eligible for nudging, regardless of age.

## Design

### File: `agents/may/handlers/task-watchdog.ts`

Exports `create()` conforming to `HandlerModule`.

### Escalation Ladder

| Age | Condition | Action |
|-----|-----------|--------|
| ≥ 2h | No active session working on it | **Nudge**: `ctx.manager.send()` to the target agent |
| ≥ 6h | Previously nudged, still open | **Escalate**: `ctx.log()` with ⚠️ prefix (May sees it) |
| ≥ 12h | Previously escalated, still open | **Alert human**: `ctx.notify()` (Telegram) |

### State Tracking

Use a JSONL file at `.state/task-watchdog-log.jsonl` to track actions taken. Each line:

```json
{
  "timestamp": "2026-04-05T14:00:00Z",
  "requestId": "req_abc123",
  "toAgent": "bob",
  "fromEntity": "coach",
  "action": "nudge|escalate|alert",
  "requestAgeH": 2.3,
  "task": "first 150 chars of task..."
}
```

On each run, read the log to determine what action was already taken for each request.

### Algorithm

```
1. Query DB for open requests older than 2h (any method):
   SELECT * FROM requests 
   WHERE status IN ('CREATED', 'IN_PROGRESS') 
   AND createdAt < ?   -- now - 2h
   
1b. Query DB for ALL open requests (any age, for orphan detection):
   SELECT * FROM requests
   WHERE status IN ('CREATED', 'IN_PROGRESS')
   
2. Get active session IDs (scan .state/sessions/active/ like audit-requests does)

2b. Detect orphans: open requests not in stale set whose sessionId is NOT in active sessions.
    Merge orphans into the processing set.

3. For each candidate (stale + orphaned) request:
   a. If IN_PROGRESS and has a sessionId in active sessions → skip (being worked on)
   b. Load prior actions for this requestId from JSONL log
   c. Determine next action based on escalation ladder + request age:
      - No prior nudge AND (age ≥ 2h OR orphan) → nudge
      - Prior nudge exists AND age ≥ 6h AND no prior escalate → escalate  
      - Prior escalate exists AND age ≥ 12h AND no prior alert → alert human
      - Already alerted → skip (don't spam)
   d. Execute action
   e. Append to JSONL log
```

### Nudge Message Format

Send to the target agent via `ctx.manager.send()`:

```
[task-watchdog] You have a stale request (${ageHours}h old, assigned by ${fromEntity}) that hasn't been picked up:
${task.slice(0, 200)}
Request ID: ${requestId}
Please address this in your next session.
```

### Escalation to May Log

```
ctx.log(`[task-watchdog] ⚠️ ESCALATION: Request ${requestId} to ${toAgent} (from ${fromEntity}) is ${ageHours}h old. Previously nudged, still not picked up. Task: ${task.slice(0, 150)}`);
```

### Alert to Human (Telegram)

```
ctx.notify(`🚨 Stale task alert: ${toAgent} has not picked up request from ${fromEntity} after ${ageHours}h.\nTask: ${task.slice(0, 200)}\nRequest: ${requestId}`);
```

### Edge Cases

- **All methods tracked**: Watches ALL request methods (send, call, fork, run, chat, workflow). Not just `send`.
- **Orphan detection**: Two DB queries — one for stale (>2h), one for all open. Orphans (dead session) merged into processing set and nudged immediately.
- **Self-nudge protection**: If `toAgent` is `may`, skip the nudge step (don't send yourself work notices). Still escalate at 6h and alert at 12h.
- **IN_PROGRESS with active session**: Skip — someone is actively working on it.
- **JSONL rotation**: Prune log entries older than 7 days at the end of each run.
- **DB access safety**: Wrap all DB operations in try/catch (pattern from audit-requests and watchdog).
- **Max nudges per run**: Cap at 10 nudges per run to avoid flooding agents with send() messages.
- **No max on escalate/alert**: Escalations and alerts are not capped (they're rare and important).

### Cron Entry

Add to `agents/may/cron.json`:

```json
{
  "name": "task-watchdog",
  "intervalMs": 3600000,
  "message": "[cron:task-watchdog] Check for stale requests.",
  "enabled": true,
  "handler": "task-watchdog",
  "description": "Nudge agents about stale requests, escalate to May/human if ignored (JS handler, 60min)"
}
```

### Testing (37 tests passing)

Write `test/task-watchdog.test.ts` with:
1. Fresh requests (< 2h) → no action
2. Stale CREATED request (> 2h) → nudge sent to target agent
3. Stale IN_PROGRESS with active session → skip (being worked on)
4. Stale IN_PROGRESS without active session → nudge
5. Previously nudged + age ≥ 6h → escalate to May
6. Previously escalated + age ≥ 12h → alert human via notify()
7. Already alerted → skip (no spam)
8. All methods tracked (not just send)
9. Max 10 nudges per run cap
10. Self-nudge: toAgent=may → skip nudge, still escalate/alert
11. JSONL log entries written correctly after each action
12. JSONL rotation: entries > 7 days pruned
13. Orphan detection: request with dead session → immediate nudge
14. Orphan detection: request with active session → NOT orphaned
15. Orphan detection: CREATED request with no sessionId → not orphaned (just waiting)
16. Orphan nudge message includes "orphaned" label and method type
17. Stale (non-orphan) message includes method type

### Reference Files

- Handler pattern: `agents/may/handlers/watchdog.ts` (simplest example)
- DB access + active sessions: `agents/may/handlers/audit-requests.ts`  
- JSONL log pattern: `agents/may/handlers/active-nudge.ts`
- HandlerContext API: `src/lib/handler-context.ts`
- Manager.send(): available on `ctx.manager`
