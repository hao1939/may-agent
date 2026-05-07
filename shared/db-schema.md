> **NOTE**: The requests table has been REMOVED. Use the events table instead. Do NOT recreate it.

# Database Schema Reference

Database access: use the `query_db` tool for read-only inspection. It uses the runtime `getDb()` path convention, so agents should not guess `.state/may.db` or call `sqlite3`. Handlers and workflows use `sdk.getDb()` / `ctx.getDb()`. Do not open the file read-write from bash.

## Key Tables

### sessions
Track all agent sessions.
| Column | Type | Notes |
|--------|------|-------|
| sessionId | TEXT PK | e.g. `s_1775290519021_1` |
| agent | TEXT | Agent name |
| task | TEXT | Session task/prompt |
| status | TEXT | `running`, `done`, `error`, `interrupted` |
| kind | TEXT | Session kind |
| source | TEXT | What triggered the session |
| parentSessionId | TEXT | For child sessions |
| requestId | TEXT | Linked request |
| workflowRunId | TEXT | e.g. `wr_1775034577833_vab7` |
| startedAt | INTEGER | **Epoch ms** (not ISO string!) |
| endedAt | INTEGER | Epoch ms |
| error | TEXT | Error message if status=error |
| outcome | TEXT | Session outcome |
| opCount | INTEGER | Tool operations count (**not** `ops`!) |

### requests
Inter-agent task requests.
| Column | Type | Notes |
|--------|------|-------|
| requestId | TEXT PK | (**not** `id`!) |
| fromEntity | TEXT | Sender agent (**not** `fromAgent`!) |
| toAgent | TEXT | Target agent |
| task | TEXT | Request description |
| status | TEXT | `pending`, `active`, `completed`, `failed` |
| createdAt | INTEGER | Epoch ms |
| updatedAt | INTEGER | Epoch ms |
| completedAt | INTEGER | Epoch ms |

### evaluations
Session quality evaluations.
| Column | Type | Notes |
|--------|------|-------|
| sessionId | TEXT PK | |
| agent | TEXT | |
| quality | REAL | 0-1 score |
| verdict | TEXT | `good`, `bad`, `skip` |
| overall | TEXT | Summary text |
| evaluatedByHeuristic | INTEGER | 1=heuristic, 0=LLM |
| createdAt | INTEGER | Epoch ms |

## Common Pitfalls
- Timestamps are **epoch milliseconds**, not ISO strings. Use `Date.now()` arithmetic, not `date()` SQL function.
- Column is `opCount` not `ops` or `operations`
- Column is `requestId` not `id`
- Column is `fromEntity` not `fromAgent`
- Column is `startedAt`/`endedAt` not `createdAt`/`updatedAt` (sessions table)
- No `turnCount` column — turns are tracked in memory only

## Quick Query Examples
```sql
-- Recent sessions
SELECT agent, status, opCount, startedAt FROM sessions ORDER BY startedAt DESC LIMIT 10;

-- Sessions in last 24h
SELECT * FROM sessions WHERE startedAt > (strftime('%s','now') * 1000 - 86400000);

-- Or in Bun: WHERE startedAt > ?  with Date.now() - 24*3600000

-- Session completion rate by agent
SELECT agent, status, COUNT(*) as n FROM sessions GROUP BY agent, status;

-- Pending requests
SELECT requestId, fromEntity, toAgent, task, status FROM requests WHERE status='pending';
```
