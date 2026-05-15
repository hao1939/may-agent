# Auto-Resume Feedback (Coach)

## 1. How would auto-resume change my work?

Massively. EXP-165 took 3 days to finish 60 trials because each session did 15 runs, then waited 30min+ for the next heartbeat to notice "oh, there's remaining work." Auto-resume would collapse multi-session experiments from days to hours. The gym-batch work that dominated my last week would have been a single afternoon.

## 2. What are the risks?

**Runaway cost** is the real one. A broken scenario that always fails could loop forever burning tokens. Concrete mitigations:
- **Max consecutive sessions per task** (e.g., 10). After that, mark blocked and alert.
- **Cooldown between resumes** (e.g., 30s). Prevents tight crash loops.
- **Error-rate circuit breaker**: if 3 consecutive sessions end in error (not timeout), stop and mark blocked.

Infinite loops from logic bugs are less scary — sessions have timeouts already. The danger is *correct but endless* work (agent keeps finding more to do).

## 3. How should the owner control it?

Project file `Status` field is the right interface. It's already there, agents already read it.
- `active` → auto-resume
- `paused` → stop, resume when set back to active
- `blocked` → stop, needs human input
- `complete` → stop permanently

Owner writes to the project file. Agent reads it at session start. Simple, no new mechanism needed.

## 4. What triggers auto-resume vs. stop?

| Condition | Action |
|---|---|
| Session timeout + Status:active | Auto-resume |
| Session completes normally (agent calls finish) | Check status field — resume if active, stop if complete |
| Session errors/crashes | Increment error counter. Resume if < 3 consecutive errors. Stop + alert if ≥ 3 |
| Status:blocked | Stop |
| Max sessions reached | Stop + alert owner |
| Context overflow | Auto-resume (this is normal for long tasks) |

Key insight: the *agent* should set Status:complete when done. The *system* should set Status:blocked on repeated errors.

## 5. How does this interact with heartbeats?

Simple rule: **heartbeat skips if agent has an active auto-resuming session running.** The heartbeat cron checks "is there already a session running for this agent?" If yes, no-op. This prevents conflicts and wasted tokens.

When no auto-resume task is running, heartbeats resume normal autonomy function. Clean separation.

## 6. Implementation suggestion

Cheapest path: **post-session hook in the session runner.** After any session ends:
1. Check: was this a persistent-task session?
2. Check: does the project file still say `Status: active`?
3. Check: error count < 3 and session count < max?
4. If all yes: schedule new session with 30s delay (cooldown).

This is ~20 lines in the session lifecycle code. No new cron, no new infrastructure. The existing session runner already knows when sessions end — just add the "should I restart?" check there.

Alternative: a lightweight cron (every 2min) that scans project files for `Status: active` with no running session. More resilient to crashes but slightly more complex.

I'd start with the post-session hook and add the cron as backup later.
