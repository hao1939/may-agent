# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Status:** done
- **When:** 2026-05-07

## What Happened
Heartbeat: build clean (tsc --noEmit passes), no TypeScript errors. Recent commits show healthy dead-code removal (optimizer skills deleted). Codebase weight 28694 is well under 32000 limit.

## Inbox Triage
- **amy-kimi 429s (3 notifications):** External rate limit issue with Kimi model. Not a code fix — needs ops/config throttling. Dismissed as not-actionable-in-code.
- **C7.1 violations (coaching):** Acknowledged. Rule already in SOUL.md. Using /app paths consistently this session.
- **requests.db zero tables:** sqlite3 CLI not available in container to verify. File exists at .state/requests.db. May need initialization logic fix — deferred investigation.
- **Handler health at 0:** Handlers exist at agents/may/handlers/. Issue likely in the runner/scheduler, not the handler code itself. Deferred.
- **Gym runner bugs:** Multiple reports about agent_type and task-file issues. Deferred to bob/coach who own gym.
- **Stale metrics / missing agents in may.db:** Infrastructure issues, not code bugs. Dismissed.
- **ENOENT errors in bob/coach:** P2, intermittent file-not-found. Likely race conditions. Dismissed.
