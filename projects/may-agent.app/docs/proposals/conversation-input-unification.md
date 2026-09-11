# Conversation and Task: one reconciliation model

**Status:** Accepted design baseline, refined September 11, 2026; implementation
is pending. Use one Task execution lifecycle for ordinary work, maintenance and
Conversation: explicit outcomes, rest between inputs, owner-controlled closure.
This supersedes the earlier recommendation to share only scheduling while
keeping two execution lifecycles. The expected simplification must still be
proved in source. Reviewed against Host `5857529e` and the current `may.app`
declaration; no runtime change or deployment is claimed.

May should discuss and work with the human while delegated work progresses,
then return useful outcomes without repeated reminders. The same loop should
serve a Task that delegates smaller Tasks. The goal is fewer execution,
settlement and recovery paths, with understandable controls and acceptable cost.
[Message Lifecycle](../2a-design/message-lifecycle.md) owns the user experience;
[Task Resource Engine](../2a-design/task-resource-engine.md#one-lifecycle-baseline)
owns the target lifecycle and distinguishes it from the implemented protocol.

## Recommendation and value

**Persist input, wake its Task, reconcile current state, commit an outcome, and
release execution. Run again for relevant pending input or justified recovery.
An authorized owner decides when to close the Task.**

```text
Human input / child result / relevant fact / optional timer
                            |
                   durable input + exact Task
                            |
                            v
                   one Task controller
                  claim a bounded attempt
                            |
                            v
                selected conversation / agent /
                   workflow / other handler
                            |
                            v
             validate and commit outcome + evidence
                            |
                +-----------+------------+
                |                        |
          notify interested owner     release execution
                |                        |
          same input loop          rest or handle pending input

App / parent agent / human -> explicit close -> fence execution and future wakes
```

Conversation retains messages, Topics and accepted Requests. One stable Task
owns its execution; a Turn is a conversation-facing name for a bounded attempt.
Do not create a Task per message or per Request. Independent delegated work
gets its own Task, so it can progress while the Conversation handles more input.
The conversation Task is the actual execution owner, with one claim and retry
authority; it does not wrap an independently executing inbox handler.

An App, parent agent or human already managing work can be its closing owner.
"External" means outside the controller's judgment, not a new service or role
registry. The executor may recommend stopping; the accountable caller or App
applies an authorized closure decision through the existing control boundary.

## Agent judges; controller carries it through

The controller exists to remove procedural work from the agent. Give the agent
the current ask, relevant evidence and unresolved decisions. It judges what is
useful next; code carries out that decision and brings back the next relevant
input. A short prompt is not enough if the agent still has to remember the
follow-through procedure.

| Agent/App judgment | Code-owned process |
| --- | --- |
| Is the evidence sufficient for this ask? | Validate and retain the outcome against the exact input and attempt |
| What independent work is needed, and what would count as success? | Admit the child, save its return link, schedule it and return its outcome |
| Does this new fact change the answer or remaining work? | Route durable input and construct the next context, even after restart |
| Is another try worthwhile, or should we ask, narrow scope or give up? | Apply bounded safe retries, waits and authorized controls; preserve failure evidence |
| Has the accepted human ask been resolved, and how should we explain it? | Commit the explanation and Request closure together; deliver through the interface |

For example, the agent asks for a measurement and states the acceptance rule.
Code records and runs that work, then returns its accepted evidence to the
caller. The caller judges whether the measurement answers the ask. It never
has to poll the child, register a subscription, copy a lease/version, or remember
to revisit the work later. Closing ordinary completed children is an App
convention applied by code; it requires no extra model turn.

Do not call the model to implement a known state transition or repeatedly ask
whether an unchanged Task should keep waiting. Do not make the controller
invent a scope change, judge uncertain evidence or declare a human ask satisfied.
If a model trial needs procedural coaching to complete the loop, simplify the
contract/context or fix the missing controller behavior before adding prompts.

A valid judgment to give up is an outcome, not an execution error. Preserve it
and return it to the caller. A provider failure, interrupted attempt or rejected
result is a different fact, handled through bounded execution failure rules.
The distinction must survive storage and restart; agents should not have to
learn a special success label to make code accept a non-success decision.

Choosing **which ask an answer resolves** is also judgment. Reading an input,
handling an event or finishing a Turn does not establish that every outstanding
ask is answered. Conversation already has typed Request decisions for this;
reuse them instead of inventing another generic obligation lifecycle. The
controller preserves the links among the accepted ask, delegated work and
returned evidence. It must carry those links across attempts and intervening
input, without asking the agent to repeat an admission ID or rebuild a wait.

The minimum follow-through trial is: ask for a measurement once, release the
attempt, answer an unrelated question, restart, then return the measurement to
its original caller. The explanation must not fulfill the measurement ask, and
the eventual measurement must not overwrite the explanation. Use real models
to judge the outcomes after the source path works. The current experiment
[fails this delayed-input correlation check](controller-poc-outcomes-and-closure.md#the-follow-through-gap);
correct one-attempt model decisions do not compensate for that process failure.

## One lifecycle, explicit outcomes

| Fact | Meaning |
| --- | --- |
| Attempt ended | Bounded execution returned or stopped; this alone establishes no success |
| Accepted outcome | Evidence establishes progress, an answer, a completed assignment, a wait or a non-success disposition for the exact work considered |
| Task is quiet | No eligible work is pending; the Task remains available for later input |
| Task is closed | An authorized owner ended further execution; history and accepted outcomes remain readable |
| Request is closed | May resolved the accepted human ask and recorded its explanation; this does not close the conversation Task |

These are meanings, not a proposed five-state enum or new public result schema.
Keep bounded execution, exact waits and visible failure evidence. Remove the
core's need to infer whether being caught up means the responsibility has ended.
A result never silently closes its Task, and closure never manufactures success.

Ordinary work uses a simple App convention: accept the assignment's result,
make it available to its caller, then request closure when no further input
needs handling. This needs no extra human approval or model call. The Host
checks the current version and pending input before applying that request, so
an old result cannot close over a newer correction. Maintenance and Conversation
usually stay open; their owners close them when appropriate. Timers are optional
for any Task and do not define a separate mode.

Parent readiness follows the accepted outcome of the exact delegated work,
not whether the child's resource is closed. Reuse current admission IDs,
generations and result references: an old successful result must not satisfy a
new assignment to the same open Task. A useful child result can wake its parent
while the child remains open for follow-up. Progress may prompt review but cannot
satisfy a request for completed work. The parent judges its own outcome.

Closure durably prevents new claims and fences late output before attempting
to abort active execution. It retains unresolved work with a visible non-success
disposition and makes that disposition discoverable to existing linked callers.
It does not delete evidence, declare Requests fulfilled, undo external effects,
or recursively cancel independent children. Owners explicitly decide which
children to close; their results remain readable if the parent is already closed.
A duplicate close is harmless. Old events and timer ticks cannot reopen a closed
Task. Start with a new linked Task for genuinely new work after closure; omit a
general reopen protocol.

An open but quiet Task consumes stored state, not a worker or recurring model
call. Safety queries select pending work, due declared waits and interrupted
claims; open status alone is not eligibility. Forgotten quiet Tasks can remain
stored initially. Optional retention policy may later close or archive them,
with unresolved asks accounted for; it is not required for execution correctness.

## Which differences are real?

| Use | Inputs and handling | Usual closure convention |
| --- | --- | --- |
| Ordinary work | Assignment, corrections, relevant facts and child results | Caller/App closes after the relevant accepted outcome |
| Maintenance | Relevant facts, optionally timer input | App or human ends the ongoing work |
| Conversation | Ordered human input and linked Task facts; handler discusses, acts and explains | Human/App ends the Conversation; Request completion leaves it available |

Long lifetime, delegation, waiting, several asks and timer input do not require
separate controllers or an `achieve`/`maintain` switch. The remaining differences
belong to input, outcome and control semantics within the same engine:

| Needed distinction | Smallest sufficient treatment |
| --- | --- |
| Input handling and human fulfillment | Retain input correlation and Request revisions; closing an ask needs its explanation, not just an ended attempt |
| Stop one execution and close its Task | Esc/Stop fences the exact Turn/input; later human input remains possible. Explicit Task closure ends future execution |
| Background pause and interactive work | Keep pause scoped to background work; a shared Task engine must not disable human discussion when background attempts are paused |
| Required result and subscribed update | Check prerequisites for the action/result they constrain; a follow-up link must not block unrelated input or the next human Turn |
| Ordered input and coalesced wake | Retain input identities and all unhandled outcomes; a queue key is only a hint |
| Failure of work and availability of its owner | Bound retries for the failing work; fresh authorized input can be considered without erasing failure evidence or blindly repeating the failed operation |
| Human execution and automated review | Select existing capacity lanes from trusted input origin and execution purpose; Task identity, App name and priority do not grant the human reserve |

Messages, Topics and Requests remain product records. They need no private
scheduler, lease or retry loop. One Task result envelope can reference typed
conversation decisions without flattening every record into a universal schema.
Code validates revisions, identity, acceptance and closure authority; the
App/LLM judges whether work is useful, sufficient or worth continuing.

## What the source actually requires

The current implementation is not this baseline:

| Source boundary | Change to prove |
| --- | --- |
| [`core/tasks/controller.ts`](../../../may-agent/src/app/core/tasks/controller.ts) and [`queue.ts`](../../../may-agent/src/app/core/tasks/queue.ts) | Reuse queue, capacity wait, wake-during-run and drain; extend execution controls without a parallel Conversation controller |
| [`composition/app-inbox-runtime.ts`](../../../may-agent/src/app/composition/app-inbox-runtime.ts) | Remove conversation execution pump/capacity/recovery after Task admission replaces it. It also serves ordinary App inputs: retain necessary admission/correlation or move those callers before deleting the whole pump |
| [`core/state/app-inbox-store.ts`](../../../may-agent/src/app/core/state/app-inbox-store.ts) and [`core/inbox/app-inbox-host.ts`](../../../may-agent/src/app/core/inbox/app-inbox-host.ts) | Current claims select input by App and exclude busy Conversations. Move execution authority to the exact conversation Task; retain ordered input, caller correlation and durable Stop evidence without a second executing claim |
| [`core/tasks/app-task-reconciler.ts`](../../../may-agent/src/app/core/tasks/app-task-reconciler.ts) | Remove mode-dependent completion/reopening/stop rules after explicit outcome and closure behavior works. Today `achieve` cannot converge with live children, generic cancellation rejects `maintain`, and handler `stopped` is restricted to finite leaf Tasks |
| [`core/state/conversation-outcomes.ts`](../../../may-agent/src/app/core/state/conversation-outcomes.ts) | Reuse Request revision and explanation checks inside fenced Task settlement; retire the supervisor's separate projection/response path |
| SDK types, readers, cleanup and App removal | Audit consumers of `done`, `converged`, receipts and mode. Accepted result, pending work and closed resource must stay distinguishable; an idle owner must not pin capacity or an execution workspace forever |

Current `dependsOn` blocks attempts while unsatisfied. The target needs result
waiting that leaves the owner available for other eligible input. Existing child
and Topic/Task links provide the starting point; do not preserve a whole-owner
execution block merely to reuse its current code. Account for the action whose
prerequisite is missing and reject unsupported success claims.

Current retry counters are Task-generation scoped, while conversational Stop
and failures attach to an input. Define the smallest common handling rule using
retained input/attempt identities. Do not rename `maintain` or add a hidden
conversation mode to retain the same lifecycle branches.

## Options and their cost

| Choice | Assessment under the accepted baseline |
| --- | --- |
| One Task execution lifecycle, explicit outcomes and owner closure | Target: remove duplicate execution authority and mode-specific lifetime rules; requires settlement, control and retained-state changes |
| Share only scheduling | Possible implementation step if it is cheaply reusable; no longer the destination or an extra mandatory extraction |
| Unify only Conversation's human/Task/timer inputs | Useful narrow slice, but leaves duplicate claims/recovery and mode-dependent Task lifetimes |

For this frequently used foundation, reduced long-term maintenance and fewer
failure paths can justify a coordinated migration. The accepted tradeoffs are
quiet retained Tasks, bounded response delay, affordable safe redo, and fewer
unsolicited progress or drift investigations. We do not need automatic lifetime
judgment, automatic reopen, precise resumption or a preemption engine.

A large code or reliability improvement is a hypothesis until a source slice
removes old paths and passes the checks below. If the implementation grows mode
switches or callbacks at every phase, reconsider the expensive contract and
narrow the slice. Do not add a universal controller framework for symmetry.
Apply the [value/cost rules](../1-principles/design-philosophy.md#how-to-decide-a-tradeoff).

## Delegation uses the same return loop

```text
Conversation's Task delegates A
  -> A delegates B
  -> B accepts an outcome -> event wakes A (B can remain open)
  -> A checks it and accepts its own outcome -> event wakes Conversation's Task
  -> handler explains it and closes the appropriate Request
  -> Conversation's Task rests, available for more input

Each caller/App may close its delegated Task after consuming the needed result.
```

A child result is evidence, not automatic parent success. Failure, closure
without success and a need for human input return through exact saved links too.
No owner keeps an execution slot merely to wait. A saved result subscription
is enough for follow-up; no per-Task watcher or generic dependency graph is added.

## Proposed controller boundary and code layout

Keep existing homes and move authority, then delete replaced code:

| Home | Target responsibility |
| --- | --- |
| `core/tasks/` | One Task controller and bounded attempt lifecycle, readiness, result admission, scoped Stop, explicit close and recovery; no Conversation-specific queue |
| `core/scheduling/` | Existing capacity and timing mechanics; no new scheduling framework |
| `core/events/` and `core/inbox/` | Durable admission, input identities/order and caller correlation; inbox records no longer execute conversation work independently |
| `core/state/` | SQLite Task claims/results/closure and typed message/Request/Topic operations; compose related writes inside one fenced settlement transaction |
| `conversations/` | Replaceable context construction, conversation handler and presentation; returns typed decisions through the Task attempt contract |
| `adapters/` | Existing execution, producer and interface capabilities; none owns an extra work lifecycle |
| `composition/` | Wire capabilities, Task-link routes and bounded timer discovery; no domain judgment or duplicate execution pump |
| `packages/sdk/`, `projects/may.app/` and `agents/may/` | Minimal public contract changes and App conventions; remove the separate follow-up Task declaration and prompt |

One controller implementation can serve independent Task keys concurrently.
Do not serialize the Host globally or require generic Tasks to carry Conversation,
Topic or Request data. The conversation handler is optional; absent capability
leaves its retained work visible and unrelated Tasks executable.

## Whole-system fit and deliberate limits

The four core responsibilities remain App admission, Events, State/storage and
Work runtime. Closure is a typed authorized state operation; it needs no event
request/reply server. Events announce meaningful committed changes and wake
interested owners. SQLite transactions enforce local consistency.

Route human input and linked Task facts to the same conversation Task and
handler. Saved Topic/Task links select recipients. Reuse `conversation.task.changed`;
no universal `conversation.wake` wrapper is needed. System facts cannot create
human authority, new Requests or unsolicited scope. Read current Task evidence
and Request revisions; a quiet system outcome needs no chat message.

The optional timer first queries unhandled outcomes or decisions. Start from
the existing 15-minute / 100-link bounds, preserve progress across pages, and
measure actual query cost; these are not a response-latency guarantee. Handle
missed notifications, late links, multiple Tasks/Conversations and new Request
revisions. Preserve handled, stopped and exhausted evidence; a timer must not
reset a retry budget or revive closed work. Required claim/restart recovery
remains Host-owned and independent of the optional timer.

Pending human input has priority over automated reviews; active reviews stay
bounded and stoppable. Background pause leaves conversation handling available.
No new preemption engine is needed. Stop fences recorded output but cannot undo
an external action already performed; inspect evidence before safe redo.

Persist explanation and Request closure with the attempt outcome, independently
of adapter delivery. Accepted Task results must remain discoverable if the Host
stops before publishing a notification. Existing failure evidence and metrics
are sufficient to investigate latency, repeated errors and idle model calls.
No new metric service, transport or user acknowledgment protocol is required.

## Implementation order

1. **Prove the revised Task lifecycle.** Using supplied decisions and temporary
   SQLite, cover a result while the Task stays open, later input, exact-result
   correlation, owner closure during execution, and duplicate wakes after
   closure. Remove mode-based decisions in the exercised path. Inventory readers,
   receipts, workspaces and caller dependencies that currently equate completion
   with closure; settle their small replacement contracts before wider migration.
2. **Run Conversation -> A -> B through that same lifecycle.** One stable Task
   executes Conversation; its Turn consumes retained ordered input and commits
   message/Request changes with the fenced outcome. Prove human input while
   children wait, exact Stop, bounded failures and source-aware capacity. Delete
   replaced conversation execution/claim/retry code; retain input correlation.
3. **Finish result routes, fallback discovery and App conventions.** Route Task
   facts and timer-selected reviews into the same handler, with quiet handling.
   Ordinary Apps close completed work by convention; Conversation and maintenance
   keep receiving input. Remove the old follow-up declaration and response path.
4. **Migrate retained state and remove compatibility branches.** Link Host/SDK/App
   revisions and integration order in reviewed PRs. Map completed finite work to
   a closed Task with its original accepted result; map quiet maintained work to
   an open Task with its accepted cycle; preserve waits, failures and all accepted
   asks. Map each existing Conversation to one execution Task and fence obsolete
   claims before activating it. Update reads, controls, cleanup and removal checks
   together; do not keep both execution owners active.

These are checkpoints, not four mandatory PRs. The proof is a source experiment,
not production dual running. A schema/table merger is unnecessary; durable
execution authority must be singular regardless of record layout. Deployment is
separate. The current maintained supervisor has no generic cancellation API:
implementation must supply a verified scoped drain/fence/retirement procedure.
Any rollback must preserve evidence and the same single-owner property.

## Acceptance and cost evidence

Reuse [PR #149's follow-through fixtures](task-runtime-organization.md#request-follow-through-review)
and existing controller/dependency tests. Those prove current mechanics, not
this lifecycle. Verify the target at its actual boundaries:

**Agent usability is an acceptance gate.** In addition to supplied-decision
tests, run real agents against isolated synthetic work through the source PoC.
Use ordinary asks and the intended judgment context, with code owning the
process above. Include a held-back variant without case-specific coaching:
delegation and return, insufficient evidence, a changed ask, and an affordable
failure where narrowing scope or giving up is better than another retry.
Record invalid decisions/calls, lost obligations, human interventions, model
turns, latency and usage. Distinguish provider failure from a bad judgment.
Compare the current and proposed boundaries on the same work; passing a new
schema alone does not prove controller usability or reduced complexity.

| Scenario | Required evidence |
| --- | --- |
| Real agent with ordinary context | Useful judgments and successful follow-through without polling, lifecycle bookkeeping or procedural coaching |
| Result accepted while child remains open | Caller proceeds using the exact result; a new assignment cannot consume an old success |
| Close while idle/running, repeated close, late event/result | No new execution or stale settlement; history remains and unresolved work is visibly non-success |
| Conversation -> A -> B, success and failure | One execution owner per Task; each owner judges its own outcome and returns it through saved links |
| Human input while children wait | The Conversation handles it without waiting for a child or falsely accepting unfinished work |
| Stop, later input, pause and exhausted failure | Scope is preserved; later work remains possible without replaying stopped work or erasing failure evidence |
| Duplicate/during-run wakes and multiple outcomes | One current attempt per Task, no lost message/outcome, another pass only when eligible |
| Reopen storage before/after result or explanation commit | Retain accepted evidence, current Request scope and one durable explanation; discover missed notifications |
| Quiet Task, timer and removed timer | No model work just because a Task is open; removing optional discovery preserves ordinary execution correctness |
| Mixed human/system input and multiple Conversations | Correct claim and capacity origin, human reserve preserved, independent keys can run concurrently |
| Ordinary App input and cross-App callers | Input-to-Task admission, caller correlation and accepted-result readiness still work after pump removal |
| Migration, cleanup, capability removal and shutdown | One execution owner, retained asks/results, no capacity/workspace pinned solely by an idle Task, visible unavailable capability |

Report deleted paths and branches, added state/hooks, migration burden and any
behavior given up. Measure idle model calls, mixed-input delay and bounded scan
cost. Run full Host CI for implementation PRs and obtain human review; live
judgment and deployment require their own evidence. A smaller diagram alone
does not establish a smaller or more reliable system.

## Documentation verification

The [source PoC checkpoint](controller-poc-evidence.md) records exact-attempt
evidence retention, real model judgment trials and the remaining result-return
obstacle. No unified lifecycle or simplification is claimed from that first slice.

This proposal changes design only. Check documentation integrity, executable
examples, local Markdown links/anchors and whitespace. It does not implement
or activate the new lifecycle, unified Conversation execution or migration.
