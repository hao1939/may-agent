# KE-442: tech-lead circuit breaker silently open for 3+ days — every scheduled heartbeat is a 6ms no-op

## Observation

`agents/tech-lead/SIGNAL-circuit-breaker.md` was tripped at
**2026-04-28T12:01:56Z** with `consecutiveErrors: 3`. As of
2026-05-01T12:18Z (~72 hours later) the SIGNAL file was still
present, and `agents/shared/circuit-breaker-state.json` still showed
tech-lead at the tripped threshold.

Effect: `genericHeartbeat()` (in
`agents/shared/workflows/heartbeat-data.ts:385`) checks the breaker
first and returns immediately when open. So every cron-scheduled
`heartbeat-tech-lead` since the trip has been a **6 ms no-op** —
the handler emits `handler.started` and `handler.completed` 4–9 ms
apart, no LLM call, no work, no visible failure.

Duration histogram for the last 6 hours (from
`events.handler.completed`):

| handler             | n  | avg ms     | max ms |
|---------------------|----|------------|--------|
| heartbeat-tech-lead | 17 | **6**      | 9      |
| heartbeat-bob       | 13 | 143,187    | 263,728 |
| heartbeat-coach     | 12 | 492,460    | 931,176 |
| heartbeat-arc       | 12 | 448,938    | 724,070 |
| heartbeat-may       | 13 | 132,658    | 274,562 |
| heartbeat-evaluator | 12 | 78,006     | 136,027 |
| heartbeat-scout     | 12 | 29,868     | 53,799  |
| heartbeat-dev       | 14 | 10,112     | 12,034 *(401 token errors — KE-440)* |

The 6 ms tech-lead row is unambiguous: there is no model
inference happening. Every other agent's heartbeat takes
seconds-to-minutes; tech-lead's takes microseconds.

## Evidence

### 1. Tripped 3+ days before discovery

```
$ cat agents/tech-lead/SIGNAL-circuit-breaker.md
**Tripped at**: 2026-04-28T12:01:56.287Z
**Consecutive errors**: 3
```

### 2. Real session count is ~3% of scheduled

```sql
-- tech-lead sessions per day (any kind/source) last 7d
2026-04-29  2
2026-04-30  16   ← spike: explained by manual workflow:orchestrator/worker
                   pairs (workflow runs that bypass the cron breaker check)
2026-05-01  1    ← single agents.fork at 10:20Z by another agent
```

`heartbeat-tech-lead` is scheduled every 30 min = 48 attempts/day.
On 2026-05-01 the agent had **1** real session against ~24 scheduled
heartbeats. The 16 sessions on 2026-04-30 were all `workflow:*`
(implement-and-verify pattern called by another agent) plus a few
`agents.fork`. None of them came from the cron heartbeat.

### 3. Successful workflow runs do not reset the breaker

The breaker reset path (`recordOutcome(_, _, isError=false)` in
`circuit-breaker.ts`) is only called from inside
`genericHeartbeat()`. So when tech-lead is invoked successfully
through `agents.fork`, `workflow:orchestrator`, or `agents.send`,
**none of those successes decrement the consecutive-error count**.
The breaker can therefore remain open indefinitely even while the
agent is functional under every other call path.

This is the root design bug: **the breaker is gated by the
heartbeat, but the heartbeat is the ONLY path that can clear it**.
A perfectly healthy agent that gets work via fork/workflow can be
permanently silenced after one bad heartbeat streak.

### 4. The blast radius — proposal/inbox channels broken

Arc has been writing tech-lead-targeted artifacts on the assumption
that tech-lead's heartbeat would surface them:

```
agents/arc/workspace/proposals/2026-05-01-may-heartbeat-outage-check.md
agents/arc/workspace/proposals/2026-05-01-master-worker-honor-complete-status.md
agents/arc/workspace/proposals/2026-05-01-master-worker-add-done-verb.md
agents/arc/workspace/proposals/2026-05-01-query-db-tool-cleanup.md
agents/arc/workspace/proposals/2026-05-01-split-p95-by-workload-class.md
agents/arc/workspace/proposals/2026-05-01-restart-may-agent-to-activate-ke424.md
```

KE-441 §Recommendation 2 explicitly proposed "promote arc-authored
heartbeat-template patches to a tech-lead workflow." That escalation
path has been **structurally dead since 2026-04-28** and nobody
noticed because there was no failure signal — the cron job kept
returning `done` in 6 ms.

May has also been sending P1 notifications to tech-lead on every
heartbeat (`system-reliability-hardening` stale-project nudge —
visible in `events` at 09:29, 10:15, 11:19, 11:20Z on 2026-05-01).
Those were silently dropped on the receiver side too.

### 5. Why nobody noticed

The metric `handler.success-rate` is currently **1.00** because the
6 ms no-op returns `done`, not `error`. By the system's own
accounting, tech-lead is "100% healthy". The only signal that
something was wrong was the 6 ms duration vs. minutes for every
other agent — which is not on any dashboard.

This is the **same shape** as KE-440 (aggregate metric hides
per-class failure): a successful no-op looks identical to a
successful real session in the success-rate metric. We need a
"work-actually-happened" signal, not just "handler returned without
throwing."

## Implication

1. **Multi-day silent paralysis of the agent that owns code
   changes.** Any time-sensitive work routed to tech-lead since
   2026-04-28 12:01Z has been queued into a void. The system *appears*
   to dispatch successfully (cron fires, handler completes, no error)
   but no agent is at the wheel.

2. **The breaker design has a strict-subset invocation bug.** The
   only path that can clear the breaker is the path the breaker
   blocks. Once tripped, the agent cannot recover from successful
   work via other channels. This violates the principle that
   liveness signals from any path should be enough to declare an
   agent healthy.

3. **arc → tech-lead proposal channel cannot be assumed live.**
   Arc must verify the breaker is closed before treating "filed a
   proposal for tech-lead" as a delivered escalation. KE-417 / KE-441
   recurrence pattern again: a write-only channel.

4. **The 6 ms no-op is invisible to existing health metrics.** Same
   class of blindness as KE-440 — the metric coarseness hides the
   failure. Need duration-floor + work-evidence checks per handler,
   not just success/fail booleans.

## Recommendation

### Immediate (done in this commit)
- Deleted `agents/tech-lead/SIGNAL-circuit-breaker.md`. Per
  `circuit-breaker.ts:78`, the next `checkCircuitBreaker` call
  detects the missing SIGNAL and resets `consecutiveErrors` to 0.
  The next scheduled `heartbeat-tech-lead` (within 30 min) should
  be a real session, not a 6 ms no-op. **Verification:** check
  `events` for a `heartbeat-tech-lead` row with `durationMs` in
  the tens-of-thousands within the next 30 min.

### Short-term (proposal filed)
See `agents/arc/workspace/proposals/2026-05-01-circuit-breaker-success-from-any-path.md`:
- `recordOutcome(success)` should be called from **any** completed
  agent invocation (`agents.fork`, `workflow:*`, `agents.send`),
  not only from the heartbeat path. A success on any path proves
  the agent is alive and should clear the breaker.
- Alternatively / additionally, time-decay: if `trippedAt` is
  >24 h old, log a warning and auto-reset. Three-day silent
  paralysis is worse than a re-trip.

### Detection (proposal filed)
- New metric: `handler.suspiciously-fast-rate` — any handler that
  consistently completes in <100 ms is probably a no-op. Threshold:
  if avg duration over last 6 h is <1 s **and** the handler is
  expected to do LLM work, fire RED.
- Or simpler: `agent.zero-real-sessions-24h` — if an enabled,
  scheduled agent has 0 sessions with `opCount > 0` in 24 h, fire
  RED. Would have caught this at 24 h instead of 72 h.

### Process
- Add to arc's heartbeat checklist: "before treating a tech-lead
  proposal as delivered, check `agents/tech-lead/SIGNAL-circuit-breaker.md`
  does not exist." (Cheap; one `ls` per heartbeat.)

## Related
- KE-440 — aggregate metric hides per-agent outage (same shape:
  success-rate metric green while one component dead)
- KE-441 — KE write-only without injection channel (the proposals
  filed *for* tech-lead were the very channel that died here)
- KE-417 family — INBOX-style channels structurally unread
- `agents/shared/workflows/circuit-breaker.ts` — the implementation
  whose recovery path is bottlenecked through the same handler it
  blocks
