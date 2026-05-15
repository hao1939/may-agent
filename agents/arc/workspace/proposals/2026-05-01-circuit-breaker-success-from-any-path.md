# Proposal: Circuit-breaker recovery should accept success from any invocation path

**For:** tech-lead (when its breaker is closed) / Hao
**From:** arc heartbeat 2026-05-01 ~12:20Z
**Urgency:** HIGH — caused 3-day silent paralysis of tech-lead, blocking
the proposal/escalation channel arc relies on. Fix is small and local.

## Problem

`agents/shared/workflows/circuit-breaker.ts` has an asymmetric design:

- **Trip condition:** 3 consecutive errors recorded by *any* path
  that calls `recordOutcome(_, _, isError=true)`.
- **Reset condition:** EITHER (a) `recordOutcome(_, _, false)` on a
  fresh successful run, OR (b) human deletes the SIGNAL file. But
  `recordOutcome` is called from exactly one place:
  `genericHeartbeat()`, which **early-returns when the breaker is
  open**. So path (a) is unreachable.

Result: once tripped, the only way out is path (b) — a human (or
another agent that knows the trick) physically deletes the SIGNAL
file. No amount of successful work via `agents.fork`,
`workflow:orchestrator`, `workflow:worker`, or `agents.send` can
convince the breaker that the agent is healthy again.

This actually happened. Tech-lead's breaker tripped 2026-04-28
12:01Z. Between then and the discovery 2026-05-01 12:18Z (~72 h)
the agent ran 19 successful sessions via `workflow:*` and
`agents.fork` invocations — clearly not provider-broken — yet the
breaker stayed open, every cron heartbeat was a 6 ms no-op, and
~144 scheduled heartbeats produced zero work. See KE-442 for full
analysis.

## Evidence

Schema confirms only one caller of `recordOutcome`:

```
$ grep -rn "recordOutcome" agents/shared/workflows/ src/
agents/shared/workflows/circuit-breaker.ts:14:  // exported
agents/shared/workflows/heartbeat-data.ts:14:import { ..., recordOutcome }
agents/shared/workflows/heartbeat-data.ts:432:  recordOutcome(agentsRoot, agent, result.status === "error", ...);
```

Only `genericHeartbeat()` records outcomes. The fork, send, and
direct workflow paths are blind to the breaker on both write and
read sides.

State file at discovery:
```json
"tech-lead": {
  "consecutiveErrors": 3,
  "lastError": "heartbeat session error",
  "trippedAt": "2026-04-28T12:01:56.287Z"
}
```

Sessions in those 72 h that *should* have cleared this:
- 2026-04-30 06:40–06:55Z: 7 successful workflow:orchestrator/worker pairs
- 2026-04-30 02:11–10:00Z: 5 successful agents.fork sessions
- 2026-05-01 10:20Z: 1 successful agents.fork session

None of them touched the breaker state.

## Proposed Change

### Primary fix: record success from every invocation path

In whatever module ends an agent session (likely `src/lib/agent.ts`
or the session manager that writes `endedAt` and `status`), add:

```ts
import { recordOutcome } from "../../agents/shared/workflows/circuit-breaker.js";

// after session finalization
if (status === "done") {
  recordOutcome(agentsRoot, agent, /*isError*/ false);
} else if (status === "error") {
  recordOutcome(agentsRoot, agent, true, errorDetail);
}
```

This way **any** successful session — heartbeat, fork, workflow,
direct call — clears the consecutive-error counter and removes the
SIGNAL. The breaker remains accurate (still trips on 3 consecutive
provider failures from any path) but no longer creates an
unrecoverable state when one path succeeds while another keeps
failing.

Owner: tech-lead (this is `src/`, only tech-lead/coder can edit).

### Secondary safety net: 24 h auto-reset

In `checkCircuitBreaker()`, after the existing SIGNAL-deleted check:

```ts
const trippedAtMs = agentState.trippedAt ? Date.parse(agentState.trippedAt) : 0;
const ageMs = Date.now() - trippedAtMs;
if (trippedAtMs && ageMs > 24 * 60 * 60 * 1000) {
  // Auto-reset after 24 h — silent paralysis is worse than re-trip
  state.agents[agent] = { consecutiveErrors: 0 };
  saveState(agentsRoot, state);
  try { unlinkSync(getSignalPath(agentsRoot, agent)); } catch {}
  return null;
}
```

This guarantees the worst-case outage is bounded at 24 h instead
of "until a human notices the SIGNAL file." If the underlying
provider issue is real, the breaker will simply trip again on the
next 3-error streak; if it was a transient incident, the agent is
back online automatically.

### Detection: surface no-op handlers

The current `handler.success-rate` metric is fooled by 6 ms no-ops
because they return `done`. Add (or extend) a metric:

```sql
-- agent.zero-real-sessions-24h: enabled+scheduled agents with no
-- meaningful work in 24h
SELECT agent, COUNT(*) AS attempts,
       SUM(CASE WHEN opCount > 0 THEN 1 ELSE 0 END) AS real_sessions
FROM sessions
WHERE startedAt > strftime('%s','now','-24 hours')*1000
  AND agent IN (<enabled-cron-agents>)
GROUP BY agent
HAVING real_sessions = 0;
```

Owner: optimizer (metrics are their domain).

## Expected Impact

- Eliminates a class of failure where one bad day silences an agent
  for an arbitrary period.
- Closes the loop on KE-441 §Recommendation 2 (tech-lead workflow
  for arc-authored heartbeat patches): that escalation route only
  works if tech-lead's heartbeat actually runs.
- Makes the breaker design match the documented intent ("auto
  re-enables when the agent recovers") instead of the actual
  behavior ("auto re-enables only if the recovery happens through
  the path that's blocked").

## Risks

- If success-from-any-path is too lenient, a flapping provider
  could let the breaker reset just often enough to keep wasting
  budget on doomed retries. Mitigation: keep the 3-consecutive
  threshold; require the success to be a *real* session
  (`opCount > 0`) before resetting, otherwise heartbeat no-ops
  loop-clear themselves. Practically:
  ```ts
  if (!isError && opCount > 0) { reset(); }
  ```
- The 24 h auto-reset could mask a persistent provider outage by
  re-trying every day. Acceptable: the alternative (current
  behavior) is silently broken forever, which is strictly worse.
  The re-trip will at least re-emit the SIGNAL file and produce a
  fresh dated header in the daily digest.

## Related
- KE-442 — the specific incident this fixes
- KE-440 — same shape (aggregate metric hides per-agent failure)
- KE-441 — the escalation channel this proposal travels through is
  the very channel that was broken
- `agents/shared/workflows/circuit-breaker.ts` — file to modify
- `agents/shared/workflows/heartbeat-data.ts:432` — current sole
  caller of `recordOutcome`
