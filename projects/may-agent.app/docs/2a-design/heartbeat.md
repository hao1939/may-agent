# Heartbeat

**Design status:** Accepted.
**Implementation status:** Implemented for standalone agents. Project-app
owners use app schedules and owner workflows instead of standalone heartbeats.

## Purpose

A heartbeat is the recurring review cadence for a standalone agent's standing
responsibility. It gives an otherwise reactive agent a bounded opportunity to
inspect owned signals, decide whether work is needed, and record evidence.

```text
timer.tick -> standalone heartbeat workflow -> agent judgment -> evidence/events
```

A heartbeat is a trigger, not a work identity, queue, or project lifecycle.
The workflow/session it starts is the bounded execution. Events and owner state
remain the durable loop.

## Scope

Use a standalone heartbeat only when an agent has a standing responsibility
that no project app owns.

| Owner type | Recurring review mechanism |
| --- | --- |
| Standalone global agent | `agents/<name>/workflows/<name>-heartbeat.ts` |
| Project-app owner/specialist | App schedule emits `project.owner.requested` or another typed app event |
| Runtime infrastructure | Mechanical handler/schedule and ops-health routing |

Do not run both a standalone heartbeat and a project-app owner cadence for the
same responsibility. App-local agents normally set `"heartbeat": false`.

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
  project app or agent-owned knowledge/context.
- Urgent P0 signals may start immediate bounded work; lower-priority signals
  normally wait for the next review cadence or owning project event.

## Project Owner Review

Project apps may use a low-frequency creative/health review in addition to
event-driven owner wakes. This is a project schedule, not a standalone agent
heartbeat:

```text
app schedule
  -> project.owner.requested { reason: "scheduled-owner-review" }
  -> normal owner workflow
```

The same owner workflow reviews event-driven and scheduled input. The schedule
does not create another planning controller or task lifecycle.

## Human Steering

Human steering should target the relevant chat, session, or project directly.
“Trigger heartbeat now” is only appropriate for a standalone agent whose
standing review context is the intended target. Project steering should emit
`project.owner.requested`; it should not depend on an agent heartbeat.

## Health

A standalone heartbeat is healthy when it:

- runs near its configured cadence;
- reviews current owned signals rather than stale prompt text;
- records an evidence-backed action or no-op;
- avoids duplicate dispatch and repeated blind retries;
- surfaces provider/runtime failures visibly.

A project app is healthy based on project events, owner workflow runs, task
motion, delivery, and evidence—not on standalone heartbeat coverage.

## Implementation

- Helper: `@may-agent/sdk` heartbeat-data utilities.
- Auto-generation: `src/app/loader/heartbeat-loader.ts`.
- Standalone workflows: `agents/<name>/workflows/<name>-heartbeat.ts`.
- App owner schedules: `projects/<id>.app/app.ts`.
- Governing Agent App contract: [agent-app.md](agent-app.md).
