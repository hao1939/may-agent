# DESIGN: Layer 3 Dispatch Dedup Guard

## Date: 2025-05-04
## Status: PROPOSED
## Parent: EXP-860 (Zombie Task Circuit Breaker)
## Problem

The system accumulates hundreds of interrupted "zombie" sessions because **handlers re-dispatch identical tasks on every cron tick** without checking whether a prior session with the same task already exists (interrupted, running, or recently failed).

Evidence from current system_status (2025-05-04):
- 397 "active" sessions, ~350+ are interrupted zombies from weeks ago
- Repeating patterns: "Ship EXP-188 finish-guard" (15x), "Process scout notifications" (10x), "Resume context-learning project" (12x)
- All zombies share trait: status=interrupted, ages 300-350h

## Root Cause Analysis

```
Cron tick → Handler fires → Creates new session with task
                            ↓
                    No check for existing sessions with same task
                            ↓
                    Session gets interrupted (timeout/resource)
                            ↓
                    Next cron tick → identical session created
                            ↓
                    Repeat indefinitely
```

Layer 2 (agent-level skill) cannot fix this because:
1. The agent never gets to "decide" — the session is created before the agent runs
2. Even if the agent recognizes the pattern, the infrastructure keeps creating new sessions
3. Interrupted sessions don't execute finish() so no signal flows back

## Proposed Solution: Pre-Dispatch Dedup Check

### Where to Intercept

In `genericHeartbeat()` or the workflow runner, **before** forking work sessions, add:

```typescript
function shouldDispatch(ctx: WorkflowContext, agent: string, taskDescription: string): boolean {
  const db = ctx.getDb();
  
  // 1. Check for recent sessions with similar task (fuzzy match on first 80 chars)
  const taskPrefix = taskDescription.substring(0, 80);
  const recentSessions = db.prepare(`
    SELECT id, status, created_at FROM sessions 
    WHERE agent = ? 
      AND task LIKE ? 
      AND created_at > datetime('now', '-7 days')
    ORDER BY created_at DESC
    LIMIT 10
  `).all(agent, taskPrefix + '%');
  
  // 2. Count interrupted/failed attempts
  const failedAttempts = recentSessions.filter(
    s => s.status === 'interrupted' || s.status === 'error'
  ).length;
  
  // 3. Apply backoff: don't re-dispatch if ≥3 failures in last 7 days
  if (failedAttempts >= 3) {
    logSkippedDispatch(agent, taskDescription, failedAttempts);
    return false;
  }
  
  // 4. Don't dispatch if one is currently running
  const running = recentSessions.find(s => s.status === 'running');
  if (running) return false;
  
  return true;
}
```

### Backoff Schedule

| Failed attempts (7d) | Action |
|---|---|
| 0-2 | Dispatch normally |
| 3-4 | Skip dispatch, log warning |
| 5+ | Skip dispatch, create escalation for human review |

### Escape Hatch

- Human can reset the counter via `dispatch-override.json` or a CLI command
- Tasks marked `force: true` bypass the check
- Counter resets if the task description changes (even slightly)

## Implementation Plan

1. Add `dispatch_history` table or reuse session data:
   ```sql
   CREATE TABLE IF NOT EXISTS dispatch_dedup (
     agent TEXT,
     task_prefix TEXT,
     last_attempt TEXT,
     fail_count INTEGER DEFAULT 0,
     PRIMARY KEY (agent, task_prefix)
   );
   ```

2. Wire into `genericHeartbeat` before the `fork()` call for work sessions
3. Wire into project iteration dispatch (the other major source of zombies)
4. Add metrics: `zombie_tasks_blocked` counter

## Expected Impact

- **Immediate**: Prevent 9+ zombie sessions/day (based on Apr 21-28 data)
- **Token savings**: Each zombie session consumes ~5-15K tokens before interruption → $2-5/day saved
- **Clarity**: System status becomes readable (not 397 stale sessions)

## Risks

- False positives: legitimate retries blocked → mitigated by 3-attempt threshold
- State accumulation: dedup table grows → add TTL cleanup (delete entries older than 30 days)

## Relationship to Other Layers

- **Layer 1** (session GC): Clean up old interrupted sessions → cosmetic, doesn't prevent new zombies
- **Layer 2** (agent skill): Agents avoid re-dispatching → helps for agent-initiated dispatch only
- **Layer 3** (this): Infrastructure prevents repeated dispatch → addresses root cause

## Next Steps

1. ~~Identify exact code path where work sessions are forked from heartbeat~~ DONE
2. ~~Implement `shouldDispatch()` guard~~ DONE → `agents/shared/workflows/dispatch-dedup-guard.ts`
3. Wire guard into heartbeat workflows (import and call before ctx.runAgent)
4. Deploy and measure over 48h
5. If successful, propose session GC (Layer 1) to clean historical zombies

## Implementation (2025-05-06)

Module: `agents/shared/workflows/dispatch-dedup-guard.ts`
- `shouldDispatch(agent, task)` → `{allowed, reason, attempts}`
- `recordDispatch(agent, task)` — call before dispatching
- `recordOutcome(agent, task, status)` — call after completion
- `unblock(agent, task)` — manual escape hatch
- `getBlockedTasks()` — diagnostics
- `cleanup()` — TTL-based garbage collection

State: `.state/dispatch-dedup.json` (no DB dependency).
Threshold: 3 failures in 7 days → auto-block.
