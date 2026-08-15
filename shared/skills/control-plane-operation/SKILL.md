---
name: control-plane-operation
description: >
  Use may-agent infra through the intended control plane: events, workflows,
  SDK query/metrics helpers, and the daemon socket.
---

# Skill: Control Plane Operation

## When to Apply

Use this skill when you need to interact with may-agent runtime behavior:

- trigger or inspect an event,
- resume or steer work,
- inspect sessions, metrics, alerts, or workflow runs,
- write a handler/workflow,
- debug CLI, Web UI, Telegram, cron, or socket behavior.

## Core Rule

Use the control plane first.

```text
conversation input -> May App inbox -> answer or delegation -> delivery
project comment fact -> declared App subscription -> correlated App inbox request
system fact -> task subscription, exact task wake, App subscription, or observation
```

The App inbox item is the commitment for an addressed result. A task is the
commitment for a durable desired outcome. Events and traces explain facts and
causality; they never replace either work authority.

For task-enabled apps, control-plane activity is a wake, not a second
scheduler. A timer, semantic event, external Condition observation, or
meaningful direct-child transition wakes the same stable task key. The shared
runtime owns queueing, claims, retry, concurrency, and recovery; app code owns
domain correlation and policy. `project.task.reconciled` is an observation for
read models, never a refill or recovery command.

Direct DB reads are for diagnosis. Direct DB writes are mechanical infra work
only, and should normally live behind SDK/query/metrics helpers.

## Preferred Surfaces

| Need | Prefer |
|---|---|
| Normal project request | Project comment ingress -> declared App subscription -> correlated App request |
| Repeated stable app automation | Discover a typed App action -> validate -> App input admission |
| Conversational human input | Admit one request to the `may` App |
| Task-enabled project judgment | App `tasks.resolve` -> stable task -> resolved owner or owner-owned workflow |
| Runtime maintenance callback | Narrow internal handler with no domain work authority |
| App workflow live reads | Scoped `ctx.read` or workflow-collected context |
| Metric creation/update | Scoped `ctx.metrics.*` |
| Agent-facing live data | `query_db` tool or workflow-injected facts |
| Historical dashboard reads | DB projection read |

## Protocol

### 1. Find the Boundary

Before editing code, classify the path:

- Adapter: CLI/Web UI/Telegram/timer.
- Control: socket/control frame, including read-only discovery or typed App
  action invocation that returns an App-admission receipt.
- Handler: deterministic host-internal maintenance adapter with no App work
  authority.
- App resolver/controller: correlate an event to desired task state and
  reconcile the latest resource level.
- Workflow: context collection, function steps, sessions, metrics.
- Agent session: judgment and action.

Fix the lowest boundary that actually owns the bug.

### 2. Use Canonical Ingress Instead Of Calling Internals

Invoke declared App actions through App admission. Publish a daemon fact only
for an observation, exact task wake, or host-internal maintenance operation
whose contract is explicitly event-shaped.

Typical source checkout:

```bash
bun src/app/may.ts --emit trigger.metrics-snapshot '{}'
```

Dockerized daemon fallback:

```bash
docker exec may-agent may-agent --emit trigger.metrics-snapshot '{}'
```

If socket connection fails, report the convention path and runtime namespace.
Do not add socket candidate scanning unless there is a concrete product need.

### 3. Use The App Controller For Task-Enabled Projects

Default task-enabled shape:

```text
semantic event -> tasks.resolve -> stable task key -> owner/workflow -> reconciler result
```

The queue carries task keys, not copied work. The owner or workflow returns a
structured reconciliation result; infrastructure validates and mutates task
state. Task completion wakes an attached App request through
`app.dependency.completed`; it does not emit a parallel owner-result lifecycle.
Do not add per-task handlers, assignment events, or another request queue.

### 4. Keep Remaining Internal Handlers Mechanical

Default shape:

```
runtime fact -> internal handler -> bounded maintenance operation
```

Handlers may normalize input, deduplicate, skip no-op work, and maintain shared
runtime mechanics. Domain judgment enters a declared App request or task; an
internal handler must not become a hidden App or owner inbox.

### 5. Prefer Query Helpers Over Schema Guessing

If a workflow needs live data, use an existing query helper. If none exists and
the query shape will recur, add a targeted helper rather than teaching agents to
guess SQLite columns.

When you must query manually, inspect schema first.

### 6. Prove the Loop

After a change, trigger one representative event and verify the durable trace:

- addressed input admitted to exactly one correlated App inbox item,
- the App disposition completes, delegates, or attaches one task dependency,
- a completed dependency wakes the exact parent through
  `app.dependency.completed`,
- exact durable waits appear as task Conditions,
- handler started/completed or failed with reason,
- workflow/session linked when expected,
- terminal closure link persisted when expected,
- metric/alert or project state updated when expected,
- outbound channel delivery linked when a human response is claimed.

Do not rely only on TypeScript compile success for control-plane changes.

## Anti-Patterns

- Teaching agents to open arbitrary `.db` files from bash.
- Adding a socket command lifecycle when one semantic event receipt is enough.
- Wrapping a typed app action in `project.action.invoked` or an action-status
  record.
- Putting project or alert judgment directly inside a handler.
- Fixing Telegram, Web UI, and CLI as separate behavior paths for the same
  operator action.
- Declaring a runtime fix without a new event/app/task/workflow trace.
- Encoding task phase, child completion, retry, or refill as an external
  Condition.
- Reusing a completed task identity instead of creating a successor for a new
  desired outcome.
