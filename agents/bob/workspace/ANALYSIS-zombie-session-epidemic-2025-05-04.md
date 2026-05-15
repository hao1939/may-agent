# Analysis: Zombie Session Epidemic — 397 "Active" Sessions

**Date**: 2025-05-04 | **Author**: bob | **Severity**: High

## Problem

System status reports 397 active sessions, but only 1-2 are actually running. The rest are stale/interrupted sessions spanning back weeks (some 740+ hours old). This causes:
1. **Noise in monitoring** — impossible to see real system health
2. **Repeated dispatch waste** — same tasks re-dispatched 15+ times without completion
3. **Resource confusion** — agents can't tell what's actually running vs abandoned

## Evidence (from system_status 360m window)

- 397 "active" sessions listed
- Oldest: `may` session from 740h ago (status: done)
- Most common status: `interrupted` — not errored, not completed
- Bob alone has 15+ identical "Ship EXP-188 finish-guard" sessions, all interrupted
- Bob has 15+ identical "Resume context-learning project" sessions, all interrupted
- Coach has 10+ identical "EXP-188: Run all 75 trials" sessions, all interrupted

## Root Cause Analysis

### Hypothesis 1: No session cleanup cron
Sessions that are interrupted (timeout, crash) remain in "active" state forever. There's no garbage collector marking stale sessions as failed after N hours.

### Hypothesis 2: Retry-without-dedup
When a dispatched task interrupts, the system re-dispatches an identical task next heartbeat without checking if the previous attempt left any artifacts or partial progress.

### Hypothesis 3: No interrupt handling
Agents don't have a graceful shutdown path. When interrupted, they leave no checkpoint, so the next attempt starts from scratch.

## Proposed Fix: Session TTL + Dedup Guard

### Immediate (can ship now)
1. **Session TTL**: Any session older than 4 hours that hasn't produced output should be marked `stale` and excluded from active counts
2. **Dedup at dispatch**: Before forking a new session, check if an identical task was attempted in the last 2 heartbeats. If yes, require `force: true` or skip.

### Medium-term
3. **Checkpoint-aware retry**: When retrying an interrupted task, include the checkpoint from the previous attempt in the new session context
4. **Interrupt budget**: If a task has been interrupted 3+ times, escalate to the project owner rather than silently retrying

## Impact Estimate

- **Monitoring clarity**: Reducing 397 → ~5 active sessions would make system_status actually useful
- **Compute savings**: Each zombie re-dispatch wastes 30-120s of agent time. At 15+ retries × 10+ tasks, that's 5-30+ wasted minutes per heartbeat cycle
- **Quality**: Agents currently waste their first 5+ tool calls re-orienting on tasks they've attempted before. With checkpoints, they could resume mid-stream.

## Metric to Track

- `zombie_session_count`: sessions active > 4h with no output
- `task_retry_count`: same task dispatched > 2 times without completion
- Target: zombie_session_count < 10, task_retry_count per task < 3
