# Finding: agents("requests") ignores `limit` parameter

**Date**: 2026-03-25T00:03
**Session**: s_1774397021015_75
**Severity**: Medium (cost waste)

## Problem

When agents call `agents({ action: "requests", filter: "all", limit: 20 })`, the `limit` parameter is silently ignored. The code hardcodes `LIMIT 100` in the SQL query.

**Evidence**: Bob's session s_1774395221126_72 (412KB total, 23:35 UTC):
- Tool call at message [8]: `agents({ action: "requests", filter: "all", limit: 20 })`
- Tool result at message [11]: 56,403 bytes containing 100 items
- Expected: ~11KB with 20 items (Bob asked for 20)
- **Waste: ~45KB per call** (80% wasted)

## Root Cause

In `src/lib/manager-agents-tool.ts`, lines 432-443:
- The `limit` parameter from TypeBox schema (line 112, 128) is only wired to `peek` action (line 259)
- The `requests` action ignores `params.limit` entirely
- "all" filter hardcodes `LIMIT 100` in SQL
- "active" filter calls `getRequestsByAgentAndStatus(... 100)` — also hardcoded
- "stale" filter has no limit at all

## Proposed Fix

Wire `params.limit` (default 50) to all request queries:

```typescript
// In the "requests" case, add after the filter switch:
const limit = params.limit ?? 50;

// In "all" case:
case "all":
  requests = params.agent
    ? req.getRequestsByAgent(persistDir, params.agent, limit)
    : req.getActiveRequests(persistDir);
  if (!params.agent) {
    const db = req.getDb(persistDir);
    requests = db
      .prepare("SELECT * FROM requests ORDER BY createdAt DESC LIMIT ?")
      .all(limit) as unknown as RequestRecord[];
  }
  break;

// In "active" case:
case "active":
  requests = params.agent
    ? req.getRequestsByAgentAndStatus(persistDir, params.agent, ["CREATED", "IN_PROGRESS"], limit)
    : req.getActiveRequests(persistDir);
  break;
```

Also update the schema description for `limit` to mention it applies to both `peek` and `requests`.

## Impact

- Bob calls `agents(requests, all)` ~2x per heartbeat session
- Bob has ~24 sessions/day
- Savings: ~45KB × 2 × 24 = ~2.2MB/day of wasted token context
- At ~$15/1M tokens, that's ~$0.50-1/day direct savings
- More importantly: 45KB of useless context degrades agent reasoning quality

## Files to Modify

1. `src/lib/manager-agents-tool.ts` — Wire `params.limit` to all request query paths
2. TypeBox schema description update for `limit` field
