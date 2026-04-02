# Cost Outlier Scan — 2026-03-24T23:03

## Window
50 sessions over 6.0 hours (17:03–23:03 UTC)

## Agent Distribution (by session count)
| Agent | Sessions | Total Size | Avg Size |
|-------|----------|-----------|----------|
| optimizer | 9 | 1.4MB | 162KB |
| coach | 9 | 1.4MB | 163KB |
| bob | 7 | 1.5MB | 218KB |
| may | 7 | 0.2MB | 31KB |
| qa | 5 | 0.3MB | 60KB |
| tech-lead | 4 | 0.4MB | 99KB |
| coder | 4 | 0.1MB | 24KB |
| evaluator | 3 | 0.1MB | 36KB |
| scout | 2 | 0.1MB | 54KB |

## Top Cost Outliers (by session.jsonl size)
1. **s_1774389820798_60 — Bob — 410KB** — 7 `agents(requests)` calls, one returned 443 items (127KB)
2. **s_1774386237479_48 — Optimizer — 342KB** — 2 `agents(requests)` calls, large heartbeat context
3. **s_1774386366367_50 — Coach — 344KB** — Reads 51KB experiments journal + 109KB tool result
4. **s_1774388020884_57 — Optimizer — 332KB** — Standard heartbeat with accumulated context
5. **s_1774375420896_28 — Bob — 245KB** — 268 lines, 1 requests call

## Key Finding: `agents(requests)` Returns Unbounded Results

### Problem
The `agents({ action: "requests" })` tool has no effective result limit:
- `getRequestsByAgent()` in `src/lib/requests.ts:402` has **no LIMIT clause**
- `filter: "all"` with `agent` param calls `getRequestsByAgent()` directly — returns ALL history
- Bob called `{ action: "requests", agent: "tech-lead", filter: "all" }` and got **443 items = 127KB**
- The `limit` param in the agents tool schema is documented for `peek` only; `requests` action ignores it

### Evidence
- Bob session s_1774389820798_60: Line 16 contains 290KB (127KB from 443 request records formatted as JSON)
- The requests response includes ALL historical requests for tech-lead, not just recent ones
- Bob makes 7 requests calls per session (checking tech-lead × 6, coach × 3), even though most return the same data

### Impact
- Bob's avg session size is 218KB (highest of all agents), partly driven by requests bloat
- Each requests call injects tens of KB of historical data into the context window
- At $10/MTok input, 127KB = ~$1.27 per call. Bob's 7 calls ≈ $2-5 wasted per session

### Proposed Fix (code change)
In `src/lib/requests.ts:402`, add LIMIT to `getRequestsByAgent`:
```typescript
// Before:
.prepare("SELECT * FROM requests WHERE toAgent = ? ORDER BY createdAt DESC")
// After:  
.prepare("SELECT * FROM requests WHERE toAgent = ? ORDER BY createdAt DESC LIMIT 50")
```

And in `src/lib/manager-agents-tool.ts`, the `"all"` case with `params.agent` should also limit:
```typescript
case "all":
  requests = params.agent
    ? req.getRequestsByAgent(persistDir, params.agent)  // Already limited by SQL
    : ...
```

Alternatively, respect the `limit` param from the tool schema for the requests action too.

### Secondary: Coach Reads 51KB Experiments Journal
Coach session s_1774386366367_50 reads the full experiments journal (51KB of historical gym results). This is a compaction candidate — older experiments could be archived, keeping only the last N entries.

## Meta
- Previous scan: 2026-03-24T19:33 — Bob #1 by KB (24.8%), 19.1 KB/op
- Status: Bob still #1 cost-per-session. Root cause: unbounded `agents(requests)` + large workspace reads
- Binary rebuild still needed for existing guards
