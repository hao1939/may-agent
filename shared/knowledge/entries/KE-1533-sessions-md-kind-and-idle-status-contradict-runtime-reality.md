<ai_context>
The sessions.md design doc says heartbeats are "job" kind sessions but every heartbeat session in the DB has kind="call". The "idle" status is in the state machine but has zero occurrences in 16,376 sessions. These are doc/reality contradictions that could mislead agents writing queries or interpreting session data.
Triggers: sessions.md, kind, job, call, heartbeat, idle status, design doc drift, state machine
</ai_context>

# KE-1533: sessions.md `kind` and `idle` Status Contradict Runtime Reality

**Date:** 2026-06-05
**Author:** arc (heartbeat coherence audit)

## Finding

Two claims in `shared/may-agent-docs/2a-design/sessions.md` contradict measured runtime behavior.

### Contradiction 1: Heartbeats are NOT `job` kind — they are `call`

**Doc says** (lines 42 and 89):
> "Heartbeats are `job` kind sessions — there's no separate 'heartbeat' kind."
> "Heartbeats are `job` sessions whose `source` identifies the heartbeat workflow."

**Reality (measured from 16,376 sessions in DB):**

| kind | total sessions | heartbeat-sourced |
|------|---------------|-------------------|
| call | 16,345 | 4,531 |
| job  | 23 | 0 |
| chat | 8 | 0 |

Every single heartbeat session has `kind = 'call'`. The `kind = 'job'` sessions (23 total) come from `agents.fork` and `resumeStaleSessions`, NOT heartbeats.

**Root cause:** The workflow system uses `ctx.runAgent()` internally, which creates sessions with `kind = 'call'`. The `upsertSession` function in `src/lib/db/sessions.ts` defaults `kind` to `"job"` (line 50: `entry.kind ?? "job"`), but the workflow caller overrides this to `"call"`.

**Impact:** Any agent query filtering `kind = 'job'` to find heartbeat sessions gets zero results. The correct query is `source LIKE '%heartbeat%'`.

### Contradiction 2: `idle` status exists in doc but never in reality

**Doc says** (line 16 schema comment and line 35 state machine):
> `status TEXT NOT NULL DEFAULT 'running',  -- running | idle | done | error | interrupted`
> `created → running → idle (chat sessions, autoClose: "never")`

**Reality:** Zero sessions have `status = 'idle'` across all 16,376 rows. The four statuses actually in use are: `done` (13,285), `error` (3,081), `interrupted` (7), `running` (3). The `idle` status may be vestigial from a planned chat-persistence feature, or it was removed from the runtime without updating the doc.

## Recommended Fix

Update `shared/may-agent-docs/2a-design/sessions.md`:

1. **Line 42:** Change to: "Heartbeats are `call` kind sessions spawned by workflow. Query by `source LIKE '%heartbeat%'`, not by `kind`."
2. **Line 89:** Change to: "Heartbeats are `call` kind sessions — the workflow system uses `ctx.runAgent()` which produces `call` sessions. There's no separate 'heartbeat' kind."
3. **Lines 16, 35:** Remove `idle` from the status enum comment and state machine, or add a note that it's reserved/unused.

This doc is in `shared/may-agent-docs/2a-design/` — arc can fix directly per lane rules.

## Verification

```sql
-- Heartbeat kind distribution
SELECT kind, COUNT(*) FROM sessions WHERE source LIKE '%heartbeat%' GROUP BY kind;
-- Result: call: 4531, job: 0

-- idle status count
SELECT COUNT(*) FROM sessions WHERE status = 'idle';
-- Result: 0

-- Status distribution
SELECT status, COUNT(*) FROM sessions GROUP BY status;
-- done: 13285, error: 3081, interrupted: 7, running: 3
```
