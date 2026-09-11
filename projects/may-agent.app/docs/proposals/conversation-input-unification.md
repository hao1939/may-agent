# One conversation input flow

**Status:** Accepted direction; implementation pending. Reviewed September 11,
2026 against Host `5857529e` and the current `may.app` declaration. This is a
source/design review, not a deployment or model-behavior validation.

The user should receive delegated work's outcome in the same Conversation,
without asking whether it finished. Human messages, linked Task facts and
timer-discovered follow-up should use one inbox and one conversation handler.
[Message Lifecycle](../2a-design/message-lifecycle.md#one-conversation-input-path)
owns the contract. This review owns implementation order and evidence.

## Decision and value

The current system uses a human conversation handler plus a separate May
maintain Task, `conversation/follow-up`, for background review. Both understand
the same discussion and can return text and close Requests. Unification removes
that extra execution owner for follow-up, its Task-specific result projection,
and its special prompt. It keeps the existing durable inbox, claim fences,
bounded executor and consistent Request closure.

```text
Human interface --> human input -------------------+
                                                   |
Task runtime --> Task fact --> saved-link routing --+--> durable inbox
                                                   |        |
App timer --> tick --> bounded pending-work query --+        v
                                                   conversation handler
                                                            |
                                                   state-checked outcome
                                                            |
                                               response / Request update
                                                            |
                                                   interface rendering
```

The routing function is necessary. A new adapter service, universal wake event,
queue, Request controller or subscription resource is not. Reuse
`conversation.task.changed`; the saved Topic/Task link identifies subscribers.
The timer performs a cheap query before causing model work. It does not own a
second version of the decision logic.

## Review against the whole system

| Boundary | Decision and implication |
| --- | --- |
| App admission | Admit a typed system input through an explicit route. A persisted fact or passive listener alone is not durable handling acceptance. |
| Events | Carry source and exact change identity. Task publication stays independent of chat availability; presentation events never feed execution back into itself. |
| State and storage | Keep input claims, Requests, links and Task results authoritative. Reuse atomic completion/closure and record which linked evidence a quiet or visible outcome handled. |
| Conversation | One bounded handler interprets human asks and linked facts. Preserve source, current scope and authority; a Task result cannot impersonate a human instruction. |
| Task runtime | Keep its controller, attempts, Conditions, retries and cancellation. It does not acquire a dependency on Conversation or wait for the user-facing reply. |
| Execution and capacity | Reuse bounded execution and one active Turn per Conversation. System reviews use background capacity; pending humans retain priority/reserve. An active review can still delay its Conversation. |
| Schedules | An optional App tick finds missed follow-up. Required Task/inbox recovery remains Host machinery and works without this schedule. |
| Interfaces | Continue publishing human input, rendering saved responses and targeting the exact active Turn for Stop. No Task subscription or recovery logic in Console/Telegram. |
| Metrics and errors | Use existing input failure evidence, event correlation and execution metrics. Distinguish human input from system review in analysis; record a quiet outcome without a chat message. No new metric service. |
| Core/external | Core owns durable handling and consistent state. May owns interpretation and response policy; composition wires the handler and routes. Removing it preserves Requests and Tasks while making follow-up unavailable. |

This unifies conversation coordination, not every lifecycle. A Request remains
an accepted ask, an inbox item remains input handling, and a Task remains an
independent outcome. Ordinary cross-App Task dependencies still use their
existing exact wait/result contract.

## Simplicity and accepted tradeoffs

Apply [the decision rules](../1-principles/design-philosophy.md#how-to-decide-a-tradeoff):
this is frequently used infrastructure, so the long-term cost of parallel
handling paths matters. Extra bounded computation after a crash is acceptable;
lost asks, stale closure and fabricated authorization are not.

| Choice | Value | Cost or limit we accept |
| --- | --- | --- |
| Shared handler and inbox | One context/decision/response path to maintain | Requires system-source handling, a quiet result and pending-input priority; it is more than changing subscriptions |
| Notify on results and decisions | Returns useful outcomes without polling models | Default proactive progress commentary and age-based drift investigation are reduced; Task views retain live progress |
| Timer queries before model work | Recovers missed follow-up with low idle cost | A bounded scan can take multiple ticks; there is no strict response-time guarantee |
| Serialize a Conversation | Keeps human corrections and responses coherent | A running system review can delay the next human turn; use existing bounds and Stop before inventing preemption |
| Reuse inbox result evidence | Durable no-op/replay accounting without another work store | Inspect existing queries/indexes; add only the minimal retained reference needed to identify handled changes |

Keep result explanations, explicit non-success, human decisions and authorized
exact-Task feedback. Remove routine model investigation of unchanged quiet
Tasks from the default. Task owners continue to diagnose and reconcile their
work; May can judge actual drift evidence during a relevant event or human
question. A separate proactive monitoring feature must earn its own cost.

Start with one input per relevant Task change and linked Conversation/Topic,
distinguishing a new or revised Request that needs the same Task evidence.
Deduplicate repeated delivery of that identity. Avoid a multi-input batching
framework: it must not hide a second linked Task's outcome. Human input keeps
its order. The first version adds no automatic preemption or seamless steering.

## Code organization

Use the existing homes; no new top-level component is needed. Paths below are
relative to `projects/may-agent` unless stated otherwise.

| Home | Bounded change |
| --- | --- |
| `composition/app-inbox-runtime.ts` | Change Task-link/timer routing to durable conversation-input admission; select existing capacity lanes by admitted input origin rather than classifying every May input as foreground |
| `core/inbox/` | Reuse claim/retry/Stop machinery; ensure per-Conversation ordering and pending-human priority apply to both sources |
| `core/state/` | Extend meaningful operations for silent system completion and handled linked-evidence reads, preserving Request version and message atomicity |
| `conversations/` | Prepare source-aware context and interpret the same result contract, including a quiet review; keep semantics out of core |
| `packages/sdk/` | Add only the typed input/result contract necessary for App-declared system handling; no Host-private stores or runtime handles |
| Workspace `projects/may.app/` and `agents/may/` | Declare the route and bounded schedule; move retained follow-up guidance into the shared conversation policy and retire the supervisor-specific declaration/prompt |

The current implementation to replace is visible in
[`app-inbox-runtime.ts`](../../../may-agent/src/app/composition/app-inbox-runtime.ts),
[`mayFollowUpTask`](../../../may.app/app.ts) and
[`conversation-outcomes.ts`](../../../may-agent/src/app/core/state/conversation-outcomes.ts).
Reuse the existing
[`conversation inbox composition`](../../../may-agent/src/app/composition/conversation-inbox.ts)
and its generic input-handler contract. The App must not own SQL, a queue,
timers or a worker process. Its schedule is a declaration run by the Host.

## Implementation order

1. **Prove the common path with fixtures.** Admit a source-marked linked Task
   input, handle it through the conversation handler, and commit an explanation
   and Request disposition. Also prove quiet completion, existing Stop and
   stale-claim behavior. Leave the old installed route unchanged during source
   preparation. Do not add a runtime feature flag just for this transition.
2. **Add routing and the cheap fallback.** Use saved links and meaningful Task
   changes. Link creation checks already-finished work. Both live events and
   timer discovery reuse stable input identities and retained dispositions.
   Verify paging, pending-human priority/background capacity and no repeated
   model work for
   unchanged evidence. Do not turn a stopped/exhausted review into fresh work.
3. **Replace the old consumer in a coordinated change.** Update May's input
   schema/routes and guidance with the compatible Host. Remove the supervision
   resolver and exclusive Task-result projection only after all callers are
   checked. Keep useful state helpers and tests rather than deleting by name.
   Host PRs require the normal CI and human review; link the App revision and
   integration order.

These are implementation checkpoints, not three mandatory PRs or parallel
production paths. During the separately authorized cutover, quiesce and
drain/fence the exact old supervision Task before changing response ownership.
Retain its history and all Requests/links/results. Only one follow-up consumer
may own response publication. Use normal admission to recover outstanding
outcomes from stored evidence, including terminal Tasks. Disabling the old
subscriber alone is insufficient while an attempt can still publish.

Do not deploy either incompatible half, delete old state or restart services
as part of this documentation change. Any rollback must likewise leave one
consumer and preserve completed explanations and exact Request revisions.

## Evidence required before calling it simpler and reliable

Reuse the [Request follow-through fixtures](task-runtime-organization.md#request-follow-through-review)
from PR #149. They support the existing mechanics; they do not yet exercise the
new route. Verify the distinct boundaries below rather than copying tests for
every input label.

| Scenario | Required result |
| --- | --- |
| Task completion or non-success | Same handler returns evidence-backed text; closure matches the current ask and can explicitly be unfulfilled |
| Crash before/after input admission or response commit | Reopen SQLite; recover pending handling or missing follow-up; one durable explanation and no lost Request |
| Duplicate event, late Task link, multiple linked Conversations | Exact routing and stable response identity; no unlinked Conversation receives the result |
| Human answered or corrected scope before queued review | Current scope/closure wins; no stale closure or repeated explanation; a newly linked or revised ask can still review an older Task result |
| Multiple Tasks and more than one scan batch | Every eligible outcome remains discoverable; pending or quiet reviews do not starve later links |
| Quiet review, Stop or exhausted failure | Unchanged ticks make no new model work, bypass no limit and restart no stopped execution; a new meaningful fact remains eligible |
| Busy Conversation, Task saturation or removed capability | Admission/reads/Stop remain responsive, system reviews do not consume the human reserve, pending humans have priority, and accepted state survives degraded follow-up |
| Old consumer cutover | Fence old output, preserve history and recover pending outcomes with one response owner |

Run the applicable Host tests and full CI for implementation PRs. Separately
observe real conversation quality, follow-up latency, idle model-call cost and
query cost before claiming behavioral or performance improvement. Existing
Task-event and inbox tests plus a source review cannot establish those numbers.

The design review supports the change: it removes a dedicated follow-up Task
and consolidates responses without adding a new core service. The remaining
risk is semantic and scheduling compatibility at that shared boundary. Prove
it with the small slice above; do not expand this into a general controller or
universal event-input migration.

## Documentation verification

The revised design passes `bun run check:may-design` (document integrity,
SDK/control examples and canonical App boundaries), local Markdown link/anchor
checks, and `git diff --check`. This change contains documentation only; no
new runtime route, migration or model-backed behavior has been tested or activated.
