# Conversation execution

**Supports:** [Message Lifecycle](message-lifecycle.md). Keeps discussion responsive while accepted asks and independent work continue through the shared Task runtime.

**Choice basis:** [One authority for each resource](../1-principles/core-principles.md#one-authority-for-each-resource) and [simple first](../1-principles/core-principles.md#simple-first). Retain human promises and exact input identity while using one execution and recovery path.

**Design status:** Accepted.
**Implementation status:** Implemented in merged [Host #449](https://github.com/hao1939/may-agent/pull/449) and its paired Apps source. Conversation uses ordinary Task attempts, communication, requests and Conditions. Source integration does not establish deployment; revisions and checks belong in the [implementation record](../archive/implementation/task-owned-host-simplification-20261111.md).
The later [ingress/SDK source record](../archive/implementation/host-ingress-sdk-source-review-20261116.md)
records removal of parallel Conversation change discovery and the remaining
retained-delivery gaps. Stable Conversation execution Tasks still exist.
Replacing them with ingress-managed bounded turns and completion Hooks remains
[follow-up](../proposals/host-ingress-and-boundary-simplification-20261116.md#single-task-conversation-ownership),
not an implemented cutover.

[Message Lifecycle](message-lifecycle.md) owns what an accepted human ask means.
This chapter owns its execution, ordering, Stop and recovery. The agent judges
meaning and fulfillment; the Host validates and records authorized effects.

## Frontend: one bounded turn

A human Turn is a bounded interactive work cycle:

```text
input -> understand -> act -> inspect evidence -> answer
                        ^           |
                        +-- repair -+
```

Continue authorized work until the ask is addressed, a material human decision
is needed, independent work is durably admitted, or execution must stop. A
progress message alone is not a reason to end executable work. Discussion and
self-contained edits can finish in this Turn; independent continuation belongs
to an ordinary Task.

There is one stable execution Task per Conversation, using executor `agent`.
The App declares `conversation: { mode: "task", inputKinds: [...] }`. No separate
Conversation agent, result schema, handoff adapter or recovery controller exists.
Turns use the App's canonical workspace, including on Git Apps, preserving
local mounts and ignored context without remote Git admission. An explicitly
selected workflow may still require a Task worktree.

Human surfaces publish `conversation.message.created` with exact App,
Conversation, source and message identities. Admission durably records the
message and input before returning, without waiting for a model. The subsequent
coalesced `conversation.updated` wake refreshes presentation; it never schedules
execution itself. Agent/tool/command messages are context, not recursive human
asks. Routed system inputs keep their system origin and authority.

The common attempt receives exact inputs in `attempt.events.inputs`, original
payloads in events/continuedInputs, and bounded context in
`attempt.events.communication`. `attempt.read.communication` reads more through
an input already admitted to this Task. Task references, rendered summaries and
shared Conversation membership do not grant control or promise ownership.

### Correct a proposed result before ending the turn

Agents use the common Task `finish` contract. A rejected input scope, Topic,
Request revision or result shape should return actionable feedback while the
current invocation can correct it. Final settlement rechecks the live claim,
input identity, scope and authority transactionally; a valid preflight does not
reserve state or guarantee acceptance.

Save accepted asks and corrections before doing work through
`attempt.apply({ communication: [...] })`. Reuse the returned Request revision.
These accepted updates survive a later failed finish or Stop. Do not repeat an
external action merely to repair a result object.

Communication uses a stable operation `id` and an admitted `inputId`, with a
message, Topic decision and/or `requestUpdates`. Replaying an operation keeps
its original content. A Request closure needs its explanation in that operation,
or `replyId` naming a message already published by the same Task generation.
Existing Topics must belong to the same admitted Conversation.

For one unambiguous Conversation, a final `response` is shorthand for a message
to the latest covered direct human input, or the latest covered input if there
is no direct human input. Multiple destinations require explicit communication
`inputId`; do not combine this shorthand with explicit messages in the result.
`response` sends a message; it is not a summary of one already sent. After
publishing the answer through `attempt.apply`, omit `response` from the final
result and describe the accepted delivery in `summary` or `facts`. If an
uncertain delivery needs replay, reuse its existing communication identity.
Reply selection, Request checks and coverage use the same accepted-live-input
snapshot.

### Authorization for background work

For independently progressing work, return ordinary Task `requests` with typed
App input and a request Condition when its answer is needed. The receiving App
maps the input to existing or new work. The original Task retains the accepted
human Request and the dependency return route; the child supplies evidence.
Use scoped Task actions to revise or stop work under the existing creator and
human authority checks. There is no Conversation-only `followUp` or control field.

A message, Request save or Task reference alone schedules no work. Sharing a
Conversation or listing a Task in `taskRefs` does not transfer the promise to
that Task. Automated input cannot acquire human authority from quoted text.

### Visible admission and progress

Explain useful outcomes and material blockers plainly. Admission proves that
work was accepted, not that its outcome was achieved. A committed message is
part of shared history; transport delivery has a separate receipt.

A waiting contribution does not keep a session alive. The same Conversation
Task can handle a later question while earlier input retains its dependency
wait. Accept that question's exact input scope without consuming the older ask.
Convergence must not leave an accepted Request open for a covered input,
including live input incorporated during execution. Unrelated Requests do not
become global completion gates.

### Natural conversation rules

Preserve the accepted scope and use current evidence before asking the human
for missing information. Ask only for a material choice or undiscoverable fact;
recommend a reasonable option when possible. A correction usually refines the
same Request. New input, a pending dependency and accepted progress are separate
facts; one does not erase the others.

## One conversation input path

Human messages, selected Task outcomes and timer-discovered missing results all
enter durable admission and the same Task claim/settlement path. The stable Task
owns execution; Conversation stores messages, Topics and accepted Requests.
The generic Host executes without embedding May's domain follow-up policy.

### Routing and authority

Saved input admission supplies the reply destination and caller identity.
Ordinary App inputs can share the Task's batch while retaining their own exact
payload, admission key and return link. For human Conversation routing, callers
supply `conversationId` without forcing a Conversation execution Task through
`targetTaskId`; the Host resolves its retained lineage. Ordinary App mapping and
exact-Task routing keep their own validation rules.

Common `requests` and request Conditions deliver independent contributions via
`app.dependency.updated`. Current source projects exact inbox-backed waits
through `AppInboxHost.refreshTaskResults()` and `recoverTaskResults()`.
Those exact waits are distinct from retained Topic subscriptions and legacy
`conversation-follow-up:` relationships. The local Host repair keeps a
compatibility reader for their result/closure delivery and historical Topic
references, using live notifications and bounded periodic recovery. It reuses
saved delivery receipts and preserves late links; no supervision command or new
queue is required. This repair is unmerged. Preserve these obligations and
receipts in an equivalent migration before deleting the compatibility reader.

The required contract is one retained caller return with restart recovery,
including an outcome recorded before notification and a link added after the
outcome. A result notification does not itself fulfill the human Request or
broaden authority. A future completion Hook is outbound Task-to-caller delivery;
a Condition is inbound evidence that wakes waiting Task work. Neither requires
a second queue or grants authority from a display link alone.

### One bounded decision

The agent may answer, preserve an open ask, wait for a real contribution, apply
authorized Task feedback, or record a quiet system review. Use one ordinary Task
result, with `communication` for human messages and Request/Topic changes.
`converged` accepts the covered work, `waiting` retains a real dependency, and
`incomplete` preserves unfinished work needing further action. None closes the
Task automatically or proves the human promise was fulfilled.

Result acceptance, communication and covered-input settlement share the fenced
transaction. Failed settlement retains the input. Earlier explicitly applied
communications remain accepted facts. External tool effects and transport
sending are not made exactly-once by this transaction.

### Ordering and Stop

At most one attempt runs for the Conversation Task. Pending human messages have
priority over system reviews. Admission remains responsive, but this is not
instantaneous preemption of an executing review. Human turns share the App's
additional interactive place within the total Host capacity; background reviews
use background capacity and respect App pause.

Stop targets the exact observed attempt and generation. It interrupts that
attempt and stops its considered chat inputs. It preserves accepted Requests,
newer chat input and independently admitted ordinary inputs. Those ordinary
inputs retain their admission/return links and can run in a fresh attempt of
the same Task after cleanup. The stopped attempt's late result cannot settle.
A timer must not recreate the same stopped chat input. Independent Tasks retain
their own controls; stopping the Turn does not withdraw their obligations.

### Timer safety net

An optional App schedule can discover missing linked outcomes from saved state
before admitting model work. Use bounded stable paging and existing admission
identities; unchanged healthy work or an open Request alone does not require a
model turn. Repeated ticks must not reset Stop, retry exhaustion or handling
identity. A meaningful new result or revised ask can justify new input.

The schedule is a fallback discovery route. Required Task/admission recovery is
Host-owned and independent of optional schedules or `--cron`. No timer interval
promises a response deadline when capacity, failure or deliberate Stop intervenes.

### May-owned durable work

May may own an ordinary goal Task for a concrete ongoing commitment. Use another
App for existing ownership, authority or useful expertise. A matching App name
alone does not require delegation. Such work uses the same executors, controls,
requests, results and recovery as every Task; it does not shadow a Conversation.

## Recovery and performance

After confirmed old-process and descendant cleanup, recovery starts a fresh
attempt on the same Task. Ended sessions and workflow runs remain evidence;
they cannot resume execution independently. Inspect saved operation receipts
or destination state before repeating an external write. Repeated work and
bounded delay are deliberate costs of the simpler recovery model.

Reads, admission, Stop, context pages and recovery scans remain bounded. Coalesce
wake hints after preserving distinct durable inputs. Query plans, real workload
and model-backed behavior need their own evidence; structural checks do not
prove latency, comprehension or live adoption.

### Cancelled Conversation execution and successors

Cancelled/closed execution Tasks retain their history and cannot reopen in
place. Conversation lineage is proven by saved input bindings, not the executor
name, which is now `agent`. Fresh human input may establish a deterministic
linked successor. Background results and timers cannot create that successor.
Completed old inputs replay their original receipt; unfinished predecessor input
is not silently rebound. Request ownership, Stop and result routing resolve the
saved lineage and retain claim/revision fences.

## Instructions for the current attempt

Use common Task context, reads, changes and results for human and machine input.
May's instructions supply authority, judgment and communication policy; there is
no special Conversation prompt router or result protocol. The retired
`ConversationTurnResult` schemas remain historical decoders, not executable APIs.

[Operations and Recovery](../2b-manual/app-operations-recovery.md#upgrade-retired-task-contracts)
owns stopped upgrade and conversion. Source merge, document updates and passing
fixtures do not authorize deployment or prove installed behavior.
