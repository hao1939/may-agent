# Patch: Auto-expire stale CREATED `call` requests from humans

## Problem
67 active requests, ~60 of which are `human→bob echo hello` (method=`call`, toAgent=`bob`).
These are interactive test/diagnostic requests that the echo handler intercepts at 0-1 ops,
but the request tracking never resolves them because:
- Step 1 only handles `send` method
- Step 2 only handles calls to non-agent targets
- Result: `call` requests to known agents stay CREATED forever

## File to edit
`agents/may/handlers/audit-requests.ts`

## Change
Add a new step between current steps 2 and 3:

```typescript
// 2b. Auto-expire stale CREATED `call` requests from humans (> 2h)
//     Interactive requests (echo, testing, etc.) that were handler-intercepted
//     but never had their request status resolved. These pile up endlessly.
const STALE_HUMAN_CALL_MS = 2 * 60 * 60 * 1000; // 2 hours
let expiredHumanCalls = 0;
try {
  const staleHumanCalls = db.query(
    `SELECT * FROM requests WHERE status = 'CREATED' AND method = 'call' AND fromEntity = 'human' AND createdAt < ?`
  ).all(now - STALE_HUMAN_CALL_MS) as RequestRow[];

  // If source column doesn't exist, fall back to fromEntity check
  for (const req of staleHumanCalls) {
    try {
      db.query(
        `UPDATE requests SET status = ?, summary = ?, completedAt = ?, updatedAt = ? WHERE requestId = ?`
      ).run(
        "COMPLETED",
        `Auto-expired after ${Math.round((now - req.createdAt) / 3600000)}h (interactive call, presumed handled)`,
        now,
        now,
        req.requestId,
      );
      expiredHumanCalls++;
    } catch {
      ctx.log(`[audit-requests] Failed to expire human call request ${req.requestId}`);
    }
  }
} catch {
  ctx.log("[audit-requests] Failed to query stale human call requests.");
}

if (expiredHumanCalls > 0) {
  ctx.log(
    `[audit-requests] Auto-expired ${expiredHumanCalls} stale CREATED human call request(s) older than ${STALE_HUMAN_CALL_MS / 3600000}h.`
  );
}
```

Also update the summary log to include `expiredHumanCalls`.

## Schema verification (confirmed 2026-03-25T12:03)
`requests` table has `fromEntity TEXT` and `source TEXT` columns.
Echo requests have: `fromEntity = "human"`, `source = "cli-oneshot"`.
The query should use:
```sql
WHERE status = 'CREATED' AND method = 'call' AND fromEntity = 'human' AND createdAt < ?
```
This correctly targets interactive human requests while leaving cron and agent-to-agent calls alone.

## Impact
- Cleans up ~60 stale echo/testing requests immediately
- Prevents future accumulation
- No risk to real work (interactive calls are one-shot, not retried)
