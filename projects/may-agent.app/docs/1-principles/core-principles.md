# Core Principles

**Design status:** Accepted.

These principles explain why the current design looks the way it does. Start
with [system-model.md](../2a-design/system-model.md) for the concrete mental
model.

## 1. Apps own meaning; the Host owns mechanics

An App decides what an input means, what outcome it owns, and whether one
bounded attempt completed that outcome. The Host validates and admits input,
persists state, schedules attempts, limits concurrency, recovers after restart,
and exposes observations.

Do not put domain policy in queues, adapters, sessions, or storage code. Do not
make App code manage leases, retries, delivery bookkeeping, or database rows.

## 2. Events carry input and facts

An event is the small interface for something that happened. A declared route
may turn it into an independently correlated App request, revise or wake a
task, or merely observe it. A record-only fact is still valid when nobody needs
to act.

Required input is accepted only by its explicit route. There is no generic
owner fallback for an unknown target or unhandled fact.

See [events.md](../2a-design/events.md).

## 3. Durable work has an explicit owner

An App inbox item owns one independently correlated result. A task optionally
owns desired-state identity that must converge across bounded attempts. A
session, workflow, event, metric, queue entry, or delivery receipt never
becomes a second work lifecycle.

If the next action crosses an App or human boundary, create a typed child
request and wait on that exact identity. Escalation is an explicit handoff, not
a routing fallback.

See [work-model.md](work-model.md) and
[agent-app.md](../2a-design/agent-app.md).

## 4. Context is discovered, not dumped

Prompts contain enough identity, request state, and pointers to begin. Agents
discover project history, skills, knowledge, metrics, and design details when
needed. Continuity lives in durable App/project/task state and session
evidence, not an ever-growing default prompt.

See [sessions.md](../2a-design/sessions.md) and
[skills.md](../2a-design/skills.md).

## 5. Match the mechanism to the responsibility

First decide what is owned:

```text
one independently correlated result            -> App inbox item
desired state across repeated bounded attempts -> task
changed or observed state                       -> fact
```

Then decide how one bounded attempt runs:

| Need | Smallest suitable mechanism |
| --- | --- |
| Deterministic calculation or adapter | TypeScript helper |
| Context-dependent judgment | Agent, optionally guided by a skill |
| Stable ordering, branching, limits, or verification | Workflow |
| Mechanical detection | Observer, guard, or metric |

Asynchrony, restart survival, importance, or frequency alone do not require a
task or workflow.

## 6. Evidence before complexity

Use the smallest mechanism that can test the hypothesis. Add structure only
when evidence identifies a repeated failure that the structure prevents.
Known safety-critical protocols may justify structure immediately; otherwise
prefer a bounded direct attempt before inventing a framework.

See [evidence-first.md](evidence-first.md),
[code-vs-data.md](code-vs-data.md), and [evolution.md](evolution.md).

## 7. Metrics are observations, not decisions

Metrics expose health, progress, and blind spots. A breach is evidence for the
owning App to interpret, not automatic proof of failure or permission to
mutate work. Pair activity measures with outcome evidence where useful, and
retire metrics whose meaning is weak.

See [metrics.md](../2a-design/metrics.md).

## 8. Human interfaces share the Conversation

Console and Telegram append to and render the same Conversation resource.
May's persisted result completes semantic work and becomes conversation
content. Each adapter chooses an appropriate presentation and independently
tracks transport attempts; adapter delivery never gates or rewrites the work.

See [human-control-surfaces.md](../2a-design/human-control-surfaces.md).

## 9. Prefer explicit declarations with useful conventions

Conventions reduce repetition and make ownership easy to find. Executable
behavior still has an explicit, typed, validated declaration: one `app.ts`, one
`defineApp`, and one atomic App generation. Do not add a second loader,
service locator, or implicit route merely to avoid a small declaration.

## 10. Debug from evidence

When behavior is wrong, inspect the complete causal path:

1. the request and context the model saw;
2. authoritative App, task, and session state;
3. runtime admission, scheduling, concurrency, and recovery evidence; and
4. external provider or transport evidence.

Fix the layer that violated its contract. Prompt problems are common, but so
are stale state, incorrect scheduling, resource pressure, and adapter faults.
Do not assume either the model or infrastructure is guilty before checking.

## Review rule

A change fits these principles when the answer to each question is clear:

- Which App owns the meaning and terminal result?
- Is this a request, desired-state task, or fact?
- What is one bounded attempt, and why is its mechanism necessary?
- Which state is authoritative?
- Which Host mechanic preserves and advances it?
- What evidence proves completion or explains lack of progress?
