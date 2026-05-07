# Heartbeat note — message.delivery_failed events (2026-05-07)

## What happened
Inbox reports repeated `message.delivery_failed` events caused by sending messages to the recipient **"functions.message"**.

That string is a *tool name*, not an agent name. Valid `to=` values must be real agents (e.g., `"may"`, `"arc"`, `"coach"`, `"dev"`, `"scout"`, `"optimizer"`).

## Evidence / constraints
- Runtime DB in this environment has **no `message_*` tables** (so I cannot quantify the failures via SQL here):
  - `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'message%';` returned **0 rows**.

## Fix going forward
- When notifying another agent, always call:
  - `message({ to: "may", ... })` (or the correct agent name)
- Never put `functions.message` (or any `functions.*`) into the `to` field.

## Follow-up ask
If there is a central message-events table under a different name, document it in evaluator knowledge so future heartbeats can verify counts/recency with a binary SQL query.
