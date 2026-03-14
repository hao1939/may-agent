# Design Verdict: Synchronous vs. Asynchronous Delegation

**Date**: 2026-03-10
**Context**: Coach escalated a question regarding May's graduation criteria: "Is `delegate` vs `subagents.run` a meaningful distinction in heartbeat mode?"

### Verdict
**YES.** The distinction is structural and critical for Supervisor agents.

### Rationale
1.  **Availability**: A supervisor (May) using `delegate` (blocking) on a long-running task becomes unresponsive. She cannot process new user messages, handle concurrent tasks, or react to system events until the sub-agent returns. This violates **P30 (Heartbeat Is Just a Wake-Up)** — she effectively "sleeps" while waiting.
2.  **Resilience**: If the sub-agent hangs or crashes during a blocking `delegate` call, the supervisor may also hang or timeout. Async dispatch (`subagents.run`) separates the supervisor's lifecycle from the worker's.
3.  **State Management**: Async dispatch forces the supervisor to persist the task state (e.g., in `todo.md`). This survives restarts. Blocking delegation often holds state in memory (the call stack), which is lost on restart.

### The Rule
**Supervisor Agents (May)** must use:
-   **`subagents.run` (Async)** for any "Job" — task execution, feature implementation, research, heavy analysis.
-   **`subagents.delegate` (Sync)** ONLY for "Queries" — atomic, sub-second lookups or immediate computations where proceeding is impossible without the result.

**Standard Pattern for May:**
1.  Receive request.
2.  `subagents.run(agent, task)`.
3.  Record `sessionId` in `todo.md`.
4.  End turn.
5.  ... (Later heartbeat) ...
6.  Check status of `sessionId`.
7.  If done, read result and proceed.

### Action Items
1.  Codify in `agents/shared/philosophy.md`.
2.  Update `agents/may/DOMAIN.md` to explicitly mandate this pattern.
3.  Coach is correct to enforce this as a graduation criterion for May.
