# Design Review: Cron & Session Architecture

## Philosophy Check: Unified Cron & Session Design

### Aligned ✅
- **Deterministic Guardrails (P14)**: The design now explicitly handles concurrency (`skip` policy) and runaway processes (`timeoutMs`), moving these checks from agent judgment to infrastructure code.
- **File System as Memory (P11)**: The addition of `.state/job-history.jsonl` provides a traversable, persistent memory of system events that survives restarts.
- **Measurable Operations (P18)**: The `JobResult` interface standardization ensures that both AI and JS tasks produce comparable metrics (duration, status, artifacts).

### Refinements Made
I have updated `docs/cron-session-design.md` with the following architectural hardening:

1. **Concurrency Control**: Explicitly defined `skip` (don't stack) as the default policy for overlapping heartbeats and jobs.
2. **Zombie Management**: Added mandatory `timeoutMs` and `SIGKILL` logic for spawned job processes.
3. **Compaction Safety**: Defined a "Hard Reset" fallback if persistent sessions hit context limits and compaction fails.
4. **Unified Indexing**: Introduced `.state/job-history.jsonl` so agents can efficiently query "what happened since I last woke up?" without expensive file tree scanning.

### Implications for Implementation
- **Cron Runner**: Needs to implement the `JobResult` schema and the JSONL appending logic immediately.
- **Heartbeat Agent**: Will need a tool or pattern to read the tail of `.state/job-history.jsonl` efficiently.
