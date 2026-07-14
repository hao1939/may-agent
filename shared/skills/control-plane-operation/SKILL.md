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
human input -> human.input.received -> one semantic intent -> bounded work -> terminal evidence -> channel delivery
system signal -> owner/target routing -> handler/workflow -> evidence -> state update -> follow-up event
```

The root event and trace are the commitment. Do not add a parallel request
record or lifecycle.

Direct DB reads are for diagnosis. Direct DB writes are mechanical infra work
only, and should normally live behind SDK/query/metrics helpers.

## Preferred Surfaces

| Need | Prefer |
|---|---|
| External adapter or CLI action | `packages/control` client or `may-agent --emit`; free-form human text enters through `human.input.received` |
| Judgment/action from an event | handler bridge -> workflow |
| Workflow or handler live reads | `sdk.query.*` or targeted workflow-collected context |
| Metric creation/update | `sdk.metrics.*` |
| Agent-facing live data | `query_db` tool or workflow-injected facts |
| Historical dashboard reads | DB projection read |

## Protocol

### 1. Find the Boundary

Before editing code, classify the path:

- Adapter: CLI/Web UI/Telegram/timer.
- Control: socket/event frame.
- Handler: deterministic bridge from event to workflow.
- Workflow: context collection, function steps, sessions, metrics.
- Agent session: judgment and action.

Fix the lowest boundary that actually owns the bug.

### 2. Emit Events Instead of Calling Internals

For operator actions, emit a daemon event through the convention socket path.

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

### 3. Keep Handlers Thin

Default shape:

```
event/timer -> handler -> workflow
```

Handlers may normalize input, deduplicate, skip no-op work, and dispatch a
workflow. Put prompts, multi-step context gathering, retries, and judgment in
the workflow.

### 4. Prefer Query Helpers Over Schema Guessing

If a workflow needs live data, use an existing query helper. If none exists and
the query shape will recur, add a targeted helper rather than teaching agents to
guess SQLite columns.

When you must query manually, inspect schema first.

### 5. Prove the Loop

After a change, trigger one representative event and verify the durable trace:

- event accepted by the responsible domain consumer or queryable owner inbox,
- handler started/completed or failed with reason,
- workflow/session linked when expected,
- terminal closure link persisted when expected,
- metric/alert or project state updated when expected,
- outbound channel delivery linked when a human response is claimed.

Do not rely only on TypeScript compile success for control-plane changes.

## Anti-Patterns

- Teaching agents to open arbitrary `.db` files from bash.
- Adding a new socket command when an event frame is enough.
- Putting project or alert judgment directly inside a handler.
- Fixing Telegram, Web UI, and CLI as separate behavior paths for the same
  operator action.
- Declaring a runtime fix without a new event/handler/workflow trace.
