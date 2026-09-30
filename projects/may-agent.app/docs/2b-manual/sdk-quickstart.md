# App SDK Quickstart

Create a small Task-based App, submit one review, and read its progress. This
walkthrough assumes a working Host installation and a configured model. Run the
commands from the workspace root. The [App/results](../examples/app.ts) and
[control client](../examples/client.ts) are checked by `bun run check:may-design`.

## 1. Inspect the runnable App

The canonical [sample App](../../../sample.app/README.md) is included in this
workspace. Read its [definition](../../../sample.app/app.ts),
[reviewer instructions](../../../sample.app/agents/reviewer/AGENTS.md) and
[seed](../../../sample.app/tasks/seed.json). The documentation imports that same
App so the example cannot silently drift into a second implementation.

Its `sample-reviewer` uses the configured `gpt-5.6-sol` model. Select another
installed model in its `agent.json` when necessary. The seed establishes the
structural `root` referenced by the Task; an empty store does not invent it.

The App accepts a `review` input with a subject and optional source references.
An ordinary `message` addresses an existing Task. The pure `task(request)` mapper
creates a review with a concrete outcome and acceptance criteria. Importing the
definition has no effects. The Host validates and activates a complete registry
generation before admitting work. [Agent Convention](agent-convention.md) explains
agent tools and prompt files.

The separate [result examples](../examples/app.ts) illustrate waits and typed
dependencies; their external pipeline/governance counterparts are illustrative
and are not installed by the sample. The [basic cooperation scenario](../../../sample.app/scenarios/basic-cooperation.md)
uses installed Apps and preserves its real execution evidence.

## 2. Check and activate

Run your App's checks before activation. The workspace's `bun run check:may-design`
checks these source examples: SDK/control types, seeded Task admission and replay,
and Condition/dependency result admission. It does not run the reviewer model.

Commit the new App and agent definitions in the installation's definition source
checkout, then use Console's `/reload` through the normal App activation
procedure. Reload rejects uncommitted executable definitions. Wait for its
completion result; a reload receipt alone is not successful activation. See
[Operations and Recovery](app-operations-recovery.md#failed-app-reload).

A daemon runs Tasks without
`--cron`; that flag enables optional schedules. Check your installed Host
revision: this startup separation merged in PR #96 and does not change an older
running binary. Validation is recorded in the
[core proposal](../archive/implementation/core-separation-review-20260910.md#step-1-implementation).

## 3. Submit and read the review

Use your installation's actual control socket. The conventional path is
`.state/instances/<instance>/<agent>.sock`; the client has no default endpoint.

```sh
sample_socket=/absolute/path/to/may.sock
bun projects/may-agent.app/docs/examples/client.ts submit "$sample_socket"
```

The client publishes `app.input.requested` for `sample`, with input
`{ kind: "review", data: { subject: "the release notes" } }` and a stable
idempotency key. Repeating this command requests the same review. For a new
subject or a distinct review, change both input and key in the client.

Save the returned `eventId` and read it, replacing `123` below:

```sh
bun projects/may-agent.app/docs/examples/client.ts event "$sample_socket" 123
```

The receipt reports `recorded` or `accepted`. Admission normally attaches the
Task immediately; if mapping or storage fails, the durable input remains for
recovery. The event view's request link gives the Host input ID. In this sample,
the mapping below makes the Task ID `review/<request-id>`. Read that exact Task
after attachment:

```sh
bun projects/may-agent.app/docs/examples/client.ts task "$sample_socket" 'review/REQUEST_ID'
```

A `null` Task read can mean attachment is still pending; reread the event for
the request's state. Once attached, inspect the Task's status, summary and
evidence. `pending`/`running` mean work remains, `waiting` names a dependency,
`attention` needs correction or judgment, and `done` means an accepted outcome.
Inspect `closed` separately to tell whether the owner ended the Task. Later reads
use the same IDs. Neither publication nor a process exit proves success.

New accepted work awaiting execution reads as `pending`, even when retained
results describe a successful earlier attempt. Exact reads and status-filtered
lists agree. Human views label open convergence `up to date`; there is no
separate maintained-Task lifecycle.

## 4. Understand the two mappings

| Callback | Receives | Returns |
| --- | --- | --- |
| `task(request)` | `AppTaskInput`: Host `id`, trusted `source`, and validated domain `input` | `{ kind: "existing", taskId }` or `{ kind: "desired", intent }` |
| `tasks.resolve(event)` | A fact matching a declared Task subscription | `TaskIntent` or `null` when no desired work follows |

Read domain fields from `request.input`. The SDK callback uses a generic input
type; the example narrows it to the schema the Host already validated.
`task` cannot return `null`. Use an observation route, or the fact resolver's
`null`, for facts that create no work.

The example uses the Host request ID for Task identity, so repeating the same
admitted input resolves to the same Task. When your domain has a stable outcome
key, use it to attach related inputs to the same unfinished work. Never use
list position or a session ID as Task identity.

## 5. Extend the bounded attempt

With no workflow or named executor, the selected agent performs the Task.
Add a workflow only when there is a repeatable procedure worth preserving.
[Workflow Authoring](workflow-authoring.md) explains the module convention and
[Task Reconciler Authoring](handler-authoring.md) explains accepted results.

Task-bound workflows receive `ctx.reconciliation` with exact identity, current
input, unaccepted events and bounded child views. Return Task changes in the
result; do not open Task storage or implement a recovery loop.

The App example also exports `waitingResult` and `dependencyResult`. The first
names pipeline run 123, its expected state, accountable `app:pipeline`, and a
five-minute recovery review. The second requests an outcome from another App.
Both include the Task result's own `summary` and `facts`.

Use these results after replacing their example identities with your actual
producer and App contracts. A review deadline is recovery insurance; time passing does
not prove that a pipeline completed. See the
[Condition contract](../2a-design/task-resource-engine.md#conditions) and
[cross-App dependencies](../2a-design/escalation.md#app-to-app-escalation).

Use `createTestAppWorkflowContext` from `@may-agent/sdk/testing` for bounded
workflow checks with explicit fake reads and execution results. Cover repeated
input identity, accepted results, waits and dependencies as you add them.

See [App Contract](../2a-design/agent-app.md), [SDK](../2a-design/sdk.md), and
[Adoption Checklist](agent-app-adoption-playbook.md) for further detail.
