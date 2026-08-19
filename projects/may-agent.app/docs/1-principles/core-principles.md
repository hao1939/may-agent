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
may translate it to App input, wake an exact task or Condition, or merely
observe it. Caller correlation is added only when someone expects a result. A
record-only fact is still valid when nobody needs to act.

Required input is accepted only by its explicit route. There is no generic
owner fallback for an unknown target or unhandled fact.

See [events.md](../2a-design/events.md).

## 3. Requests own delivery; tasks own App work

The Host keeps one request when a caller expects a correlated result. The App
handles that responsibility by reconciling one task. Simple work converges in
one bounded attempt; difficult, waiting, decomposed, or maintained work keeps
the same task across attempts. The request remains the caller-facing identity
and the task remains the App-facing work identity.

An App action is only a named, validated way to create a request. A task tree is
only a read-only arrangement of tasks by their declared relationships. Neither
is another work lifecycle or state authority. A session, workflow, event,
metric, queue entry, or delivery receipt is not one either.

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
caller expects a correlated result -> Host request linked to an App task
App must make an outcome true       -> task
changed or observed state only      -> fact
```

Then decide how one bounded attempt runs:

| Need                                                | Smallest suitable mechanism         |
| --------------------------------------------------- | ----------------------------------- |
| Deterministic calculation or adapter                | TypeScript helper                   |
| Context-dependent judgment                          | Agent, optionally guided by a skill |
| Stable ordering, branching, limits, or verification | Workflow                            |
| Mechanical detection                                | Observer, guard, or metric          |

Every actionable App input becomes or wakes a task. Asynchrony, importance, or
frequency do not require a workflow or another work mechanism.

An App becomes more powerful by adding domain policy, acceptance checks,
learned workflows, and bounded capabilities available during reconciliation.
Those extensions must not add App-owned storage, workers, schedulers, retries,
recovery, or delivery paths.

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
