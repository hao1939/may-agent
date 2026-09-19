# Task resource read interface

**Design status:** Accepted.
**Implementation status:** Implemented as part of the Task resource engine; source status is not deployment evidence.

This reference is part of the [Task resource engine](task-resource-engine.md) contract.

Exact Tasks use the same small resource-read shape inside and outside an App.
There is one transport-neutral service backed by canonical task state:

```text
tasks.list({ appId, status?, limit?, cursor? })
  -> bounded TaskPage

tasks.get({ appId, taskId })
  -> TaskDetail or not-found
```

The programmatic App read capability also exposes an opt-in shadow view:

```text
tasks.outcomes({ includeDone? })
  -> TaskOutcomePage
```

The model-facing Task tool requires an exact Task identity and returns only the
outcome containing that Task:

```text
tasks.outcomes({ taskId, includeDone? })
  -> TaskOutcomePage
```

This prevents a reconciliation attempt that already knows its Task or accepted
wait from loading the App's complete outcome projection into model context.
Use bounded `tasks.list` for discovery and `tasks.get` for exact Task detail.

The current shared `TaskView` is deliberately small:

```text
{ id, status, generation, outcome, summary?, response?, result?, facts? }
```

The list form returns bounded views from live resources and immutable completed
receipts. It accepts exact status filters, a capped page size, and an opaque
continuation token. Omitting status includes every phase.

`result` is a bounded App-defined object for machine-readable domain decisions.
Runtime validates its transport shape and size but never interprets its domain
meaning. A parent that needs a child's verdict reads this object; it never
reconstructs the verdict from `summary`, `response`, evidence labels, or task
prose. Human explanation stays in `summary` or `response`.

The get form returns one exact `TaskDetail`, including parent, acceptance,
input, selected execution mechanism, dependencies, and Conditions. Attempt and
activity evidence remain linked records rather than copied Task truth.

The optional outcome projection groups exact Task identities for a simpler read
view while preserving every member and link. It is not a new work resource,
write API, or completion authority; list/get remain the exact Task interface.

The contract is shared; only scope binding and transport differ:

- a workflow or observer receives the same reader already bound to its current
  App;
- an agent `tasks` tool supplies the current App-attempt scope;
- the daemon control socket carries those read operations for out-of-process
  adapters;
- HTTP binds the scope through `GET /api/apps/:appId/tasks` and
  `GET /api/apps/:appId/tasks/:taskId`; and
- the UI uses the HTTP adapter and renders the returned resources.

There is no separate HTTP read model, agent task model, or SDK task model.
Adapters translate argument placement but preserve the same exact `TaskView`,
`TaskDetail`, and pagination contract.

Exact absence returns not-found. Invalid limits or continuation tokens are
caller errors. HTTP maps absence to 404 and invalid reads to a 400 response;
SDK, socket, and agent callers receive the same underlying Runtime result or
error text.

App-scoped execution may read only its own App unless the Host explicitly
grants a system-level read scope. List results are capped and paginated. Reads
never expose task storage paths, SQL, leases, or mutation handles, and they
never use `.state/tasks/tree.json` as authority.

This common resource shape does not imply a universal CRUD service. Task,
request, conversation, and execution APIs may share `get`/`list`, identity,
pagination, and error conventions while retaining typed filters and details.
The event stream is the change notification: consumers observe a relevant
event and reread current resource state. The read API does not add a second
watch cursor or delivery guarantee.

Human surfaces may ask the same Host reader for `humanActionOnly`. This is a
derived filter over live Tasks and their exact dependency leaves with at least
one unsatisfied Condition owned by canonical identity `human` or
`human:<role>`; it is not another resource or lifecycle. The result is
deduplicated by the leaf Task that owns the Condition and the bounded card adds
`{ requestedAction, since? }`. `since` is present only when the current
Condition start is known; later observation time is not a substitute. Generic
`attention`, age, display-name owners, and adapter state never satisfy this
filter.

There is deliberately no generic task write API. A caller asks the accountable
App for an outcome, optionally naming the observed task. App policy then keeps,
revises, wakes, decomposes, or closes it through the normal input-to-task path
or reconciliation result. Inside an attempt, task changes remain
generation-fenced and atomically admitted with the result.
