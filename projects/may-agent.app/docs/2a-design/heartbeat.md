# Heartbeat

**Design status:** Accepted.
**Implementation status:** Implemented for standalone global-agent duties.
Agent Apps use canonical schedules, observers, inbox inputs, and task wakes.

## Purpose

A heartbeat is the recurring review cadence for a standalone agent's standing
responsibility. It gives an otherwise reactive agent a bounded opportunity to
inspect owned signals, decide whether work is needed, and record evidence.

```text
timer.tick -> standalone heartbeat workflow -> agent judgment -> evidence/events
```

A heartbeat is a trigger, not a work identity, queue, or project lifecycle.
The workflow/session it starts is one bounded execution. It may publish evidence
or facts, but it cannot become durable project work outside an Agent App request
or task.

## Scope

Use a standalone heartbeat only when an agent has a standing responsibility
that no Agent App owns.

| Owner type                 | Recurring review mechanism                                                |
| -------------------------- | ------------------------------------------------------------------------- |
| Standalone global agent    | `agents/<name>/workflows/<name>-heartbeat.ts`                             |
| Agent App owner/specialist | App input schedule or exact task-wake schedule declared in `app.ts`       |
| Host mechanics             | Host-private schedule/handler; facts route any domain judgment |

Do not run both a standalone heartbeat and an Agent App cadence for the same
responsibility. App-local agents set `"heartbeat": false`. A workflow whose
name contains `heartbeat` may remain as ordinary App-owned workflow code, but
only a canonical App input/task route may invoke it autonomously.

A host-private operations-health handler is not an App-local agent heartbeat.
It performs bounded deterministic inspection of Runtime-owned ledgers and
publishes evidence/facts. If owner judgment is required, the fact enters the
canonical App route; the handler does not start or resume the owner directly.

## Work Context

The standalone heartbeat workflow builds a compact context from:

- agent identity and `heartbeat.md` guidance;
- owned inbox events and messages;
- current metrics and open alerts;
- recent sessions and unresolved outcomes;
- any explicit standalone projects still owned by the agent.

The agent judges the packet. It may act, start bounded work, send a message,
record a no-op, or escalate across an ownership boundary. A red metric is a
signal, not an automatic task.

## Runtime Contract

The SDK heartbeat helper loads bounded current facts and returns a task packet.
The auto-heartbeat loader discovers enabled standalone agents with a matching
workflow and creates timer entries.

```text
agent.json heartbeat enabled
  + agents/<name>/workflows/<name>-heartbeat.ts
  -> generated timer entry
  -> workflow run on cadence
```

Rules:

- Skip when the agent already has conflicting active work unless the heartbeat
  explicitly owns recovery of that work.
- Keep the cadence bounded and inexpensive.
- Emit observable skipped/failed/completed lifecycle evidence.
- Do not encode long-term plans in the timer prompt; durable goals belong in a
  Agent App or agent-owned knowledge/context.
- Urgent P0 signals may start immediate bounded work; lower-priority signals
  normally wait for the next review cadence or owning project event.

## Project Owner Review

Agent Apps may use a low-frequency creative/health review. This is an App input
schedule, not a standalone agent heartbeat or event-owned lifecycle:

```text
app schedule
  -> correlated App input { reason: "scheduled-owner-review" }
  -> inbox disposition or attached standing task
```

If time only refreshes deterministic desired work, the schedule instead emits
one fact addressed to an exact task or selected by a task subscription. The
schedule never dispatches an owner session directly or creates another work
authority.

An observer records every bounded packet but wakes the owner only when the
canonical signal-family fingerprint changes, a previously reported signal
recovers, or an explicit recheck is due. The persisted fingerprint contains
stable signal identity and decision-relevant values, not timestamps or packet
paths. Repeated unchanged red observations remain visible in health history and
do not spend another owner session.

## Human Steering

Human steering should target the relevant request, session, App action, or task
directly.
“Trigger heartbeat now” is only appropriate for a standalone agent whose
standing review context is the intended target. Project steering should emit
a correlated App input or an exact task control; it should not depend on an
agent heartbeat.

## Health

A standalone heartbeat is healthy when it:

- runs near its configured cadence;
- reviews current owned signals rather than stale prompt text;
- records an evidence-backed action or no-op;
- avoids duplicate dispatch and repeated blind retries;
- surfaces provider/runtime failures visibly.

An Agent App is healthy based on App requests, owner workflow runs, task
motion, delivery, and evidence—not on standalone heartbeat coverage.

## Implementation

- Auto-generation: `projects/may-agent/src/app/loader/heartbeat-loader.ts`.
- Standalone workflows: `agents/<name>/workflows/<name>-heartbeat.ts`.
- App owner schedules: `projects/<id>.app/app.ts`.
- Explicit host-maintenance schedules: owning agent `cron.json` plus a typed
  host-private handler.
- Governing Agent App contract: [agent-app.md](agent-app.md).
