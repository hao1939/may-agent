# Work Model

May-agent uses one work model for autonomous operation:

```
project + metrics + trigger -> agent judgment -> session -> evidence -> project update
```

## Roles

| Piece | Role |
|-------|------|
| Project | Goal, owner, current state, history, plan, and durable context. |
| Metric | Signal that something may need attention or validation. |
| Event/Cron | Trigger that wakes the system to reassess. |
| Agent | Judge and actor. Interprets signals against project context, facts, and a causal theory. |
| Session | One execution attempt. Produces evidence, changes, escalation, or a no-action judgment. |

Metrics do not judge. They signal. A red metric can mean a real regression, a
bad threshold, stale measurement, expected transition cost, missing project
context, or an accepted exception. The owner agent must decide.

## Default Loop

1. A project states the goal, owner, current plan, and relevant metrics.
2. Metrics produce signals through snapshots and alerts.
3. Cron, event subscriptions, heartbeat, or a human trigger starts a session.
4. The agent reads the project context and signal evidence.
5. The agent judges the situation and chooses one operation: act, calibrate,
   document exception, wait with evidence, route to owner, or escalate.
6. The agent records evidence in the session summary and updates the project
   when the work changes project state.
7. Later metrics and sessions provide validation signals, not automatic truth.

## Project Lifecycle

The default project mode is intensive work. No extra `run_mode` field is
needed.

- `active` means push now. The owner should keep working while there is a
  concrete next autonomous action and a meaningful validation signal.
- `waiting` means watch. The current push has reached a useful stop point, and
  the project should resume only when its `resume_condition`, `resume_after`,
  comment, event, or metric signal arrives.
- `blocked` means an external dependency prevents progress.
- `pending-review` means owner or human judgment is required before more work.
- `paused` means an intentional hold; resume only from an explicit signal.
- `done` / `complete` / `closed` means no current ownership loop is expected.

Projects move like this:

```
signal arrives -> active push -> evidence -> waiting/blocked/pending-review/done
                                      ^                  |
                                      └---- resume signal ┘
```

Do not keep a project `active` just to monitor it. Monitoring belongs in
metrics, cron/steward checks, heartbeat context, and `resume_condition`. When a
signal makes work actionable again, reactivate the project and push intensively
until the next meaningful stop.

## Work Context Convention

Every recurring work context, explicit or implicit, should answer the same
questions:

| Field | Meaning | Explicit project | Heartbeat implicit project |
|-------|---------|------------------|----------------------------|
| Goal | What are we trying to maintain or change? | `project.md` goal | agent identity / domain |
| Owner | Who is accountable? | project owner | the agent |
| Signals | What changed or needs attention? | project metrics, events, blockers | owned metrics, alerts, inbox, active projects |
| State | What is true now? | current state / journal | context, lessons, recent sessions |
| Plan | What should happen next? | project plan | heartbeat guidance |
| Evidence | What happened last time? | journal/session links | last sessions, context updates, project journals |
| Validation | How will we know the judgment was right? | later signals, tests, user feedback | later signals, tests, next heartbeat |

This convention keeps the system simple: heartbeat and project use the same
mental shape. The difference is only durability and scope.

## Heartbeat As Agent Project

Heartbeat is not a separate work mode. It is the default recurring trigger for
an agent's standing self-maintenance context.

That context is an implicit project for the agent itself:

- `AGENTS.md` / identity: what the agent is for.
- `context.md` / lessons / knowledge: what the agent has learned.
- `heartbeat.md`: what the agent should inspect on each recurring wake-up.
- Inbox, owned metrics, alerts, and active projects: current signals.
- Session summaries and project journals: evidence from prior attempts.

Do not create a shared project for every heartbeat. Use the implicit agent
project for routine self-maintenance. Create a real shared project when the
heartbeat discovers a durable goal that needs cross-session tracking, ownership,
metrics, and a journal.

When in doubt: routine domain stewardship stays in heartbeat; a concrete,
durable goal with state transitions becomes an explicit project.

## Cron vs Project

Cron is not the work item. Cron is a trigger.

Use a project when there is a goal that needs continuity across sessions:

- ongoing quality maintenance,
- a systemic gap,
- repeated failures,
- unclear root cause,
- a goal that needs multiple iterations,
- a standing responsibility whose context evolves.

Use a cron handler when the procedure is known and recurring:

- wake a project on a cadence,
- scan for missed events,
- build live context from the DB,
- skip when no action is needed,
- dispatch the owner when judgment is needed.

If a cron discovers a sustained implementation gap, it should create or update a
project. Do not make the cron prompt itself the long-term memory.

## Enforcement

Prefer structural enforcement over brittle text rules:

- Project files carry the durable goal, owner, state, plan, and journal.
- Metrics should link to `metrics.project` when they measure a project.
- Runtime ownership resolves by convention: `metrics.owner`, then
  `projects.owner`, then metric id prefix, then `may`.
- Cron handlers should build live context and dispatch sessions; they should not
  contain long static plans.
- Tests should cover routing, skip conditions, and generated context for
  recurring handlers.
- Guards should only enforce facts that are mechanically checkable.

Agent judgment remains intentional. The system can enforce that a signal reaches
an owner and that evidence is recorded; it should not pretend a metric made the
decision.
