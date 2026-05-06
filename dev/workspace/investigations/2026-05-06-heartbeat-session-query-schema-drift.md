# Investigation: dev heartbeat session query schema drift

## Signal
During the 2026-05-06 dev heartbeat, the mandated starter query from `agents/dev/heartbeat.md` failed against the live `sessions` table:

```sql
SELECT id, agent, status, error FROM sessions WHERE status='error' ORDER BY startedAt DESC LIMIT 5;
```

Runtime error observed via readonly `bun:sqlite` query:

```text
no such column: id
```

## Root cause
The live `sessions` schema uses camelCase `sessionId` as the primary key, not `id`. It also uses `startedAt`/`endedAt` rather than snake_case variants. `PRAGMA table_info(sessions)` showed:

- `sessionId TEXT PRIMARY KEY`
- `agent TEXT`
- `task TEXT`
- `status TEXT`
- `startedAt INTEGER`
- `endedAt INTEGER`
- `error TEXT`

The heartbeat doc's recent-failures query is stale. This creates friction at the first diagnostic step and can hide the actual session failure pattern behind a query failure.

## Correct query
```sql
SELECT sessionId, agent, status, error, startedAt
FROM sessions
WHERE status='error'
ORDER BY startedAt DESC
LIMIT 5;
```

## Current failure pattern after correcting the query
The corrected query returned recent session errors dominated by external model auth/capacity failures rather than handler/workflow bugs:

- repeated `401 ... IDE token expired: unauthorized: token expired` for `tech-lead`, `evaluator`, `amy`, and prior `dev` sessions
- one `429 ... No deployments available for selected model`
- one `ENOENT: no such file or directory, open` for `amy`

These are not directly fixable within dev's allowed code/workspace scope. The local fix is to update the heartbeat diagnostic query so future heartbeats get to the real signal immediately.

## Recommended follow-up
Patch `agents/dev/heartbeat.md` starter query from `id` to `sessionId`. If edits outside `agents/dev/workspace` are enabled in a future session, this is a one-line doc fix.

## Evidence
- `PRAGMA table_info(sessions)` verified `sessionId` and `startedAt` column names.
- Corrected readonly query returned the recent error rows listed above.
