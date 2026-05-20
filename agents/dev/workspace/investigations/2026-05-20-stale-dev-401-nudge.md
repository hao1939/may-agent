# 2026-05-20 Stale Dev 401 Nudge

## Summary

May sent dev a P2 FYI claiming `dev` had 64 `401 IDE token expired` errors in the last 6 hours. Live database checks during this heartbeat did not support the rolling-window claim: the `sessions` table has 0 matching rows in the last 6 hours, while the lifetime `sessions.error LIKE '%401 IDE token expired%'` count for dev is exactly 64 with latest timestamp `1778087561103` (historical May 7 era).

## Evidence

- `events` latest `message.created` to `agent:dev` at `1779266933556` contained: "You have 64 \"401 IDE token expired\" errors in the last 6h".
- `sessions` last-6h query for dev showed 16 sessions: 15 `done` plus the current `running`; all had `error IS NULL`.
- `events` last-6h search for `401 IDE token expired` found only May's `session.end` summary and the FYI `message.created`; no runtime/session error events.
- `sessions` last-6h query with `(error LIKE '%401 IDE token expired%' OR outcome LIKE '%401 IDE token expired%')` returned 0 rows.
- Lifetime `sessions` query grouped by agent returned `dev = 64`, latest `1778087561103`, matching the FYI count but not the claimed time window.

## Judgment

This was not an active dev credential/retry-loop incident. The direct dev action is to dismiss the FYI as stale/mis-windowed and avoid restarting or changing credentials. The system issue is May-side heartbeat/nudge evidence discipline: a historical/lifetime auth count was represented as a 6h signal.

## Follow-up

If this recurs, inspect May heartbeat's error-pattern query or prompt path for a missing `startedAt > unixepoch()*1000 - 21600000` filter, and consider adding a regression/nudge guard requiring timestamp evidence when a heartbeat sends time-windowed agent-specific FYIs.
