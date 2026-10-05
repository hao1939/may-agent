# Task resource read interface

**Supports:** [Task Resource Engine](task-resource-engine.md). Makes current work inspectable at bounded cost through one shared read contract.

**Choice basis:** [Core Principles](../1-principles/core-principles.md#convention-over-configuration).

**Design status:** Accepted.
**Implementation status:** The shared reader and explicit `inputKeys` reads are implemented; [Host #269 is merged](../archive/reviews/explicit-task-input-consideration-20260930.md). Source status is not deployment evidence.

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

The shared programmatic `TaskView` contains current accepted evidence:

```text
{ id, status, closed?, generation, outcome, summary?, response?, result?, facts? }
```

`status: "done"` describes accepted convergence; `closed` separately records
owner closure. Accepted results, Conditions and pending work can coexist.

The list form returns bounded views from live resources and immutable completed
receipts. It accepts exact status filters, a capped page size, and an opaque
continuation token. Omitting status includes every phase.

The agent tool presents a discovery page from that same reader: exact `id`,
`status`, `closed` and `generation`, plus `outcomePreview` and `summaryPreview`
limited to 240 Unicode code points each, without splitting surrogate pairs.
It defaults to 20 items and preserves the reader's cursor. `get` returns full
requirements and current accepted responses, results and facts. Accepted-attempt
history is an explicit `acceptedEvidence` page on `get`, with its own cursor;
a plain `get` returns its navigation, not the historical bodies. Previews are
navigation, not enough evidence to accept or revise an assignment. Programmatic
SDK/socket/HTTP callers retain the full shared view. This presentation boundary
keeps a search across many Tasks from repeatedly loading all their evidence
into the model. `includeDone` applies to `outcomes`; `list` uses `status`.

**Source status:** This discovery presentation is implemented in the compact
Task-discovery Host candidate; activate that change before relying on it. See
the [bounded trial and source record](../archive/reviews/post337-evidence-cost-20261005.md).

`result` is a bounded App-defined object for machine-readable domain decisions.
Runtime validates its transport shape and size but never interprets its domain
meaning. A parent that needs a child's verdict reads this object; it never
reconstructs the verdict from `summary`, `response`, evidence labels, or task
prose. Human explanation stays in `summary` or `response`.

The get form returns one exact `TaskDetail`, including parent, acceptance,
input, selected execution mechanism, dependencies, and Conditions. Attempt and
activity evidence remain linked records rather than copied Task truth.

The current Task reader also exposes `resourceVersion` and an observation
beside each Condition definition: its generation/revision, observed generation,
state, retained evidence and observation time. A declared requirement is not an
observation that it has been met. Historical receipts may lack a current revision
and observations; absence does not establish satisfaction.

`pendingEvents` shows up to 32 currently unclaimed inputs, with exact Event
identities and explicit truncation. The active attempt's input remains separately
available in its supplied context. This is a bounded current-input window, not a
complete history or a fulfillment flag. Remaining input keeps its existing later
reconciliation opportunity. Reading the window does not consume it.

`currentObligations.inputWaits.items` gives exact retained admission keys, timing,
useful-work flag `pending`, and input/result correlations. An active worker can inspect an earlier request
before its timer is due using `read.tasks.get(taskId, { inputKeys: [key] })`.
The same option is available on the agent's `tasks.get`, socket `app.task.get`,
and App HTTP detail route (repeated `inputKey` query parameters). Human board
`task.get` remains a separate presentation and does not provide this option.

An explicit read returns `inputEvents: [{ key, observedAt, event }]` from those
exact admissions, including the original request and its source. At most eight
keys may be requested. Bodies are absent from ordinary reads; neither reading
nor listing keys consumes an input or changes its timer. Missing bodies or keys
outside this Task fail the read explicitly. Answered input remains readable.
The existing default obligation list is capped at 100 with `truncated`; it is
not an unlimited inventory, and an exact read does not require a key to appear
in that first page. The [result contract](task-resource-engine.md) controls
settlement through the complete `inputKeys` scope. The Host saves useful
continuation in current input records, independently of waits, and supplies that
work on the next attempt after continuation or retry. See the
[implementation and trial record](../archive/reviews/explicit-task-input-consideration-20260930.md)
for implementation and deployment status.

The exact read uses one synchronous SQLite read snapshot for the resource,
Conditions and input. It also forwards explicit `acceptedEvidence` options
through the Task-bound reader. Model-facing briefs shorten large bodies and link
content-addressed detail snapshots under the existing attempt context directory.
The public Task reader remains authoritative; these files retain the scope and
coverage of the original read. See the
[integration record](../archive/reviews/task-decision-context-integration-20260926.md).

### Current view and supporting detail

The human Task detail exposes at most 20 recent work-history events. Routine
`project.task.reconcile.skipped` eligibility checks and their
`project.task.reconcile.profiled` timing records without an attempt ID stay in the
event log and do not consume that window. Timing for actual attempts remains. This preserves exact reconciled attempt references for
bounded process inspection; it neither suppresses attempts nor declares a wait
healthy. `historyTruncated` describes the remaining work-history window, not the
complete event log. The evaluator tolerates skip entries from older Hosts.


The default context is a working view, not a transcript: assignment and acceptance,
current conclusions, open obligations, changed facts and exact references to their
supporting evidence. Failures, useful progress and waits can coexist. Show enough
identity and scope for the agent to choose what to read next; shrinking a body
must not hide the existence of the other inputs or make an omission look complete.
The Host exposes recorded facts and access paths; the agent judges relevance.

Repeated mechanically identical observations can be presented once with their
count, first/last occurrence and evidence references. A different error, changed
requirement or independently unresolved input remains distinguishable. A general
failure count alone does not establish that every failure had the same cause.
Full attempt records remain diagnostic evidence; summarizing the current view
does not acknowledge input, erase history or establish recovery.

**Implementation follow-up:** The managed agent already receives a short entry
and a refreshed decision brief, rather than the complete saved assignment. The
October 4 rollout nevertheless exposed an input preview that hides most input
identities, large detail reads and repeated discovery across attempts. Improve
navigation through the existing input/evidence readers before adding a new
summary store or retention mechanism. This is a presentation follow-up, not a
claim that repeated-failure grouping is implemented. See
[the live context findings](../archive/reviews/task-agent-failover-20261004.md#context-findings).

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
Adapters translate argument placement and preserve the underlying state and
pagination contract. The agent's list explicitly returns discovery previews;
its exact `get` preserves `TaskDetail`. A shortened preview is never another
source of Task truth.

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

A system-wide `humanActionOnly` read selects the eligible direct owner Tasks of
open human-owned Conditions before applying its ordinary pagination. It follows
existing Condition-to-Task links through selective indexes instead of
enumerating unrelated Tasks. Unrelated retained Tasks and Apps absent from the
loaded registry therefore cannot hide a real obligation. One owner Task yields
one card even when several Conditions match, and `total` counts all eligible,
status-filtered owner Tasks before the page cursor and limit. App- and
Task-scoped reads retain exact dependency-leaf discovery, including cross-App
leaves. That scoped traversal is currently bounded to 1,000 reachable Task
identities before human filtering; this known scoped coverage limit does not
apply a new cap to the system-wide direct-owner query.

There is deliberately no generic task write API. A caller asks the accountable
App for an outcome, optionally naming the observed task. App policy then keeps,
revises, wakes, decomposes, or closes it through the normal input-to-task path
or reconciliation result. Inside an attempt, task changes remain
generation-fenced and atomically admitted with the result.
