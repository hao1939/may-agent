# Conversation and Task: one reconciliation model

**Status:** Unified conversation inputs are accepted; implementation is pending.
A shared scheduling controller is the recommended next proof, not a demonstrated
code reduction. Representing Conversation execution as a maintained Task remains
an alternative for comparison. Reviewed September 11, 2026 against Host
`5857529e` and the current `may.app` declaration; no deployment is claimed.

The user should receive delegated work's outcome without repeatedly asking.
The same expectation applies when a Task delegates smaller Tasks. Both owners
retain the relationship, rest while independent work runs, and reconsider on
new input or a result. [Message Lifecycle](../2a-design/message-lifecycle.md#one-conversation-input-path)
owns conversational behavior; [Task Resource Engine](../2a-design/task-resource-engine.md)
owns Task state. This proposal compares how much of their implementation to share.

## Recommendation and value

Use one mental model: **persist input, wake the owner, read current state,
perform bounded work, commit the outcome, and rest or continue when justified.**
A timer restores a missed opportunity to reconsider; it does not supply another
business-logic path or authorization to retry stopped work.

```text
Human input / linked result / timer discovery
                       |
              persist input or trigger
                       |
                       v
            shared scheduling controller
            priority, capacity, one pass per key
                       |
              +--------+--------+
              v                 v
      reconcile Conversation   reconcile Task
              |                 |
              +--------+--------+
                       |
         resource-specific claim and outcome rules
                       |
              durable change -> event
                       |
             interested Conversation or parent Task
```

The candidate shares scheduling machinery while keeping existing Conversation,
Request and Task records and their atomic operations. It also routes Task and
timer follow-up through the conversation handler, replacing the separate May
`conversation/follow-up` Task. These are two related reductions: one response
path for Conversation, and one scheduling implementation for both consumers.
Neither requires one universal result schema or one merged resource table.

The earlier proposal stopped at sharing conversation inputs. This review extends
the candidate to controller reuse and removes the assumption that a maintained
Task could never represent conversation execution. Keep that larger alternative
open, but require it to remove more complexity than it introduces.

## Which differences are real?

These similarities do not justify separate controllers:

| Apparent difference | What the current design already supports |
| --- | --- |
| Conversation is long-lived; Task ends | A `maintain` Task is also long-lived and accepts later cycles. A new message need not become a new Task or spec generation. |
| Conversation reacts to people; Task executes a plan | Tasks accept new input and exact feedback. Both can use an agent or other bounded execution. Source determines authority, not resource spelling. |
| Conversation delegates; Tasks execute | Tasks already create children and typed cross-App dependencies, then receive results later. Both are execution owners and result consumers. |
| Conversation stays available while work runs | A maintained Task can finish its current review with live children and remain waiting. Follow-up does not require a live waiting session. Hard prerequisite dependencies still constrain eligibility. |
| Conversation has many asks | A maintained Task can coordinate several pieces of work. Explicit Request records remain useful for tracking human promises, whichever engine runs the owner. |

The distinctions below protect concrete behavior. They need explicit semantics,
but do not each require a different scheduler or class.

| Distinction to preserve | Why it matters | Cost of erasing it or moving it into a single Task resource |
| --- | --- | --- |
| Handling an input versus fulfilling an outcome | A reply can finish a Turn while several Requests or delegated Tasks remain open. `maintain` already separates an up-to-date cycle from permanent completion. | Task-backed Conversation needs per-input acknowledgment and Request closure evidence; a single Task phase cannot replace them. Some existing input records or equivalent bookkeeping remain. |
| Stop this execution versus pause/cancel its owner | Esc stops one exact Turn; future conversation and independent Tasks remain available. Pausing Task attempts also need not suspend discussion. These are generally useful scopes, not inherently conversation-only concepts. | Current Task controls do not provide the same operation for a maintained owner. Full unification needs durable input/attempt Stop, scoped pause, stale-output fences and rules for subsequent input. |
| Required dependency versus subscribed result | Some child work prevents the owner's outcome from finishing; other work only owes a later update. A result can wake either owner without satisfying its ask. | Treating every link as a prerequisite can make discussion unavailable. Treating every link as observation can falsely complete a parent. Keep the meaning of the relationship. |
| Ordered input versus a coalesced wake | Human corrections and multiple child results must survive even when many wake signals collapse into one queue key. Both resources need retained evidence. | Full unification must demonstrate ordered input consumption and preserve each unhandled outcome; one dirty bit or latest event cannot be the input record. |
| Failure of one input versus failure of an ongoing owner | An unsuccessful Turn must leave the ask visible and future discussion usable. Task retries are currently counted against the executing Task generation. | A maintained Conversation Task needs a clear per-input failure disposition so one exhausted input does not disable every later message. The exact retry policy is negotiable; silently broadening its scope is not. |
| Different facts committed together | Conversation completion checks the input claim, Request revision and explanation. Task settlement checks generation/attempt, acceptance, actions, Conditions and dependent results. | One generic settlement API must still express both sets of facts. A large mode switch or optional-field schema can cost more than two clear typed operations. |
| Interactive priority versus background work | The human should retain execution capacity while automated follow-up waits. Either resource can receive human input. | Reuse existing lanes with trusted source and execution purpose. App identity or P0 priority alone must not grant the human reserve. This change is needed even without a resource merger. |

Message history, Topic grouping and Request records are product information;
leases, queue keys, worker processes and the current folder names are implementation
choices. Retaining the former does not prove separate engines are necessary.
Likewise, sharing an engine does not make those records redundant.

## What the source actually requires

| Source boundary | Finding and consequence |
| --- | --- |
| [`core/tasks/controller.ts`](../../../may-agent/src/app/core/tasks/controller.ts) and [`queue.ts`](../../../may-agent/src/app/core/tasks/queue.ts) | Already accept a reconciliation callback, coalesce keys, keep a new wake during execution, manage capacity and drain. Candidate shared machinery exists. Task-specific priority defaults, background capacity and dispatch retry pacing must be separated deliberately. |
| [`composition/app-inbox-runtime.ts`](../../../may-agent/src/app/composition/app-inbox-runtime.ts) | Has another pump/capacity-wait/cleanup path, also serving non-conversational App inputs. It schedules by App identity and currently makes every selected conversation-App input foreground. Count its removal only if all retained input routes use the replacement; sharing Conversation alone may leave the pump in place. |
| [`core/state/app-inbox-store.ts`](../../../may-agent/src/app/core/state/app-inbox-store.ts) | Claims the next eligible input for an App and excludes an executing Conversation. A queue keyed by Conversation needs matching claim selection; simply renaming Task keys could serialize an entire App or claim the wrong conversation. |
| [`core/inbox/app-inbox-host.ts`](../../../may-agent/src/app/core/inbox/app-inbox-host.ts) | Owns durable input claims, Stop and failure disposition. Failed executed Turns can remain failed pending fresh human input; this must not inherit Task execution retry semantics accidentally. |
| [`core/tasks/app-task-reconciler.ts`](../../../may-agent/src/app/core/tasks/app-task-reconciler.ts) | An `achieve` Task cannot converge with live children. A `maintain` review may complete and leave the owner waiting. Generic cancellation rejects maintained Tasks, and handler `stopped` is restricted to finite leaf Tasks. Do not describe these as an existing exact-Turn Stop API. |
| [`core/state/conversation-outcomes.ts`](../../../may-agent/src/app/core/state/conversation-outcomes.ts) | The old supervision response commits an explanation and Request updates. Reuse its integrity rules through normal conversation completion before retiring its exclusive projection path. |

Fresh Task input can request reconsideration of a wait, but an unsatisfied
explicit `dependsOn` still prevents an attempt. Wake, eligibility and completion
are separate checks. A Conversation that is merely following independent work
must not acquire such a hard prerequisite.

## Options and their cost

| Option | Value | Short-term cost | Long-term cost and risk |
| --- | --- | --- | --- |
| Keep separate controllers; unify conversation inputs only | Removes the supervisor response path with the smallest scheduling change | System-input context, quiet completion, priority and follow-up recovery | Retains two pumps and their capacity/shutdown behavior; lowest immediate migration risk |
| Share scheduling controller; keep resource reconcilers **(recommended proof)** | Removes repeated dispatch mechanics and gives both the same wake/concurrency model | Extract existing queue/controller mechanics; align inbox claim key and capacity origin; exercise both consumers | Keeps distinct state operations but avoids forcing their contracts together. Worth doing only if old scheduling paths are deleted and the boundary stays small |
| Run Conversation through a maintained Task | Could share Task claims, attempts, triggers and recovery as well as scheduling | Move conversation execution authority into Task state; provide per-input Stop/ordering, closure commits, presentation and retained-state cutover | Potentially largest deletion, but input correlation, Requests and messages still exist. Risk of many conversation-specific branches and wider changes to ordinary Tasks |

In the third option, the maintained Task would be the conversation's actual
execution owner, not a second watcher or a Task wrapping an inbox execution.
Conversation would retain its message/context view; Requests would still record
accepted asks. Do not create one Task per message. `maintain` and the existing
input event log make this plausible; the unresolved cost is the missing control
and commit semantics, not the fact that discussion is open-ended.

Keeping both an executing inbox row and an independently executing maintained
Task for the same Turn would defeat that option. Conversely, not every inbox
row can be counted as removable: addressed App inputs and cross-App caller
correlation still need durable identities and outcomes.

For this frequently used foundation, compare the long-term cost of paths,
transactions, exceptional cases, recovery and operational understanding. There
is no measured latency, model-cost or code-size win yet. Avoid choosing a larger
migration because its diagram has fewer boxes. The [tradeoff rules](../1-principles/design-philosophy.md#how-to-decide-a-tradeoff)
require a better total cost for the actual goal.

Contract differences are not automatically sacred. We already accept bounded
response delay, affordable safe redo, fewer unsolicited progress reports and
no automatic model investigation of quiet work. A common failure/retry policy
could also be considered where repeated effects are safe and its cost is
acceptable. Record that behavioral change explicitly. Do not pay to preserve
an incidental mode distinction, but do preserve the user's ability to stop,
correct and receive a truthful outcome.

## Delegation uses the same return loop

```text
Conversation delegates Task A
  -> Task A delegates Task B
  -> B commits a result -> event wakes A
  -> A judges that result and commits its outcome -> event wakes Conversation
  -> Conversation explains it and closes the appropriate Request
```

At every level, the receiving owner rereads current evidence and decides what
it means. Child completion is not automatic parent success. Failure, cancellation
and a need for human input also return through exact retained relationships.
Waiting releases execution capacity; no caller waits synchronously in event
publication and no extra watcher Task is needed.

A parent link, an execution prerequisite and a result subscription are related
but not interchangeable. Reuse current child/dependency and Topic/Task links.
A shared controller does not require replacing them with a universal dependency
graph or adding a configurable link-policy framework. If a Task later needs an
additional nonblocking subscription, add only the demonstrated relation.

## Proposed controller boundary and code layout

The shared portion schedules keys and invokes a supplied bounded reconciliation
function. One implementation can serve many independent keys and preserve App
limits; it is not one serial global worker. Existing scoped Conversation/Task
identities are sufficient. Queue keys remain disposable hints, not a new stored
resource.

| Home | Responsibility in the candidate |
| --- | --- |
| `core/scheduling/` | Reuse/extract the common ready queue, capacity wait, wake-during-run and drain mechanics from the Task controller; no public registry or base-class framework |
| `core/tasks/` | Task readiness, fenced claims, attempts, acceptance, Conditions, durable retries and settlement remain here using `core/state/` |
| `core/inbox/` and `core/state/` | Retain ordered input claims, exact Turn Stop, consistent conversation completion and handled-evidence reads; support exact selection required by the shared scheduler |
| `conversations/` | Shared human/system context and conversation judgment, including quiet completion; no private queue or database authority |
| `composition/` | Wire both reconcilers, exact Task-link routing, source-aware capacity and the bounded timer query; remove replaced pump/wait/cleanup code |
| `packages/sdk/` and workspace `projects/may.app/` / `agents/may/` | Minimal typed system-input/quiet-result support and retained App follow-up policy; retire supervisor-specific declaration and prompt |

Keep the callback boundary narrow. Resource code decides eligibility, claims,
leases, failure disposition and atomic settlement. The shared controller cannot
infer fulfillment, consume a Request, reset retry budgets or make a stopped
input runnable. Its dispatch-error pacing is not permission to rerun domain work;
recheck the durable eligibility after every wake. Do not replace two clear
reconcilers with a callback for every phase of a generic state machine.

Human priority is a property of the pending input and permitted execution, not
an App name or a lane left over from an earlier wake. Readiness, capacity choice
and the eventual claim must agree on which input is being run. Preserve
per-Conversation order and independent-conversation concurrency. Tasks remain
background execution even when a human originally requested them.
Keep Task-pause eligibility scoped to its work; reusing the controller must not
turn a pause of Task attempts into an unintended pause of human discussion.

## Whole-system fit and deliberate limits

The four core responsibilities remain App admission, Events, State/storage and
Work runtime. The shared controller is ordinary Work-runtime machinery. Apps
still judge meaning; concrete conversation handling remains replaceable. Task
execution must work without any conversation capability installed.

A persisted fact or passive listener is not durable follow-up acceptance. Keep
explicit routes, exact links and the existing admission/recovery evidence.
`conversation.task.changed` is sufficient; a universal wake event is unnecessary.
Presentation updates remain observations and cannot recursively start execution.

The conversation timer first queries unhandled results or decisions. It uses
normal admission, honors handled/stopped/exhausted input dispositions and
preserves progress across bounded pages. It does not poll unchanged discussions
with the model. Required Task/inbox recovery stays Host-owned. Removing the
optional timer removes fallback discovery while retaining ordinary event handling.

Retain result explanations, human decisions and authorized exact-Task feedback.
Reduce default age-based drift investigation and proactive progress commentary;
Task views still expose progress. A running system review can delay its
Conversation's next human turn: start with bounded execution and Stop, not a
new preemption engine. Repeated safe computation after interruption is an
acceptable cost; false closure or replaying stopped work is not.

Use existing execution/error evidence and metrics to inspect follow-up latency,
idle model calls and failures. A controller merger adds no metric service, new
transport or requirement that a user acknowledge delivered text. Message/Request
closure remains atomic and independent of adapter delivery.

## Implementation order

1. **Prove one end-to-end chain through a candidate shared controller.** Use
   Conversation -> Task A -> Task B, with supplied decisions and temporary
   SQLite. Route result return into the conversation handler. Reuse the existing
   Task controller mechanics while retaining resource-specific claims and
   commits. This is a bounded source experiment, not production dual running.
2. **Evaluate deletion and compatibility before adopting the extraction.** Show
   which pump, capacity-wait and shutdown paths disappear and which rules remain.
   Account for ordinary App-input attachment/caller handling as well as chat;
   do not claim the inbox pump is removed while those callers still need it.
   Verify exact input/claim selection, Stop, failure budgets and human capacity.
   If sharing requires a mode switch at every phase, retain the smaller input
   unification or compare the maintained-Task alternative; do not grow a framework
   merely to claim one class.
3. **Finish Task/timer routing and selective recovery.** Cover missed admission,
   quiet completion, multiple links and new Request revisions using existing
   inbox/result evidence. Keep the timer cheap and independently removable.
4. **Retire the old follow-up consumer in a coordinated Host/App change.** Link
   source revisions and integration order, run normal CI and obtain human review.
   Remove the old supervision declaration, exclusive projection and replaced
   scheduling paths only after callers and retained behavior are accounted for.

These are checkpoints, not four mandatory PRs. Deployment is separately
controlled. Drain/fence the exact old `may/conversation/follow-up` execution
before switching response ownership; generic maintained-Task cancellation is
not currently available. Choose a supported scoped retirement procedure during
implementation rather than assuming that API exists. Preserve all history,
Requests, links and results, and recover pending responses through one consumer.
Any rollback must retain that same single-owner property.

The maintained-Task alternative earns reconsideration if the candidate still
leaves substantial duplicate claim/recovery logic and a small source experiment
can remove it while passing the same behavioral checks. Until then the existing
records remain authoritative; this proposal authorizes no resource migration.

## Acceptance and cost evidence

Reuse [PR #149's follow-through fixtures](task-runtime-organization.md#request-follow-through-review)
and existing Task dependency/controller tests. They prove current mechanics,
not the candidate merger. Verify these distinct boundaries:

| Scenario | Required evidence |
| --- | --- |
| Conversation -> A -> B, success and non-success | Each exact owner wakes, checks accepted evidence and handles its own obligation; no extra watcher or waiting session |
| Fresh human input while delegated work waits | Conversation responds without waiting for the child; required Task dependencies retain their eligibility/completion rules |
| Stop/pause, a late result and later input | Stop fences only its intended execution; no timer revives it, no unrelated Task is cancelled, and pausing Task attempts leaves discussion usable |
| Duplicate/during-run wakes and multiple outcomes | One active pass per key, a fresh pass when needed, and no lost ordered message or child result |
| Reopen before/after admission or result commit | Retain exact claims/obligations, one durable explanation and current Request scope; safe redo does not repeat accepted effects blindly |
| Quiet review or exhausted failure | Unchanged ticks cause no model work and reset no budget; genuinely new authorized evidence remains reviewable |
| Busy App and multiple Conversations | System work preserves the human reserve, claims the selected input and does not serialize unrelated Conversations |
| Ordinary App input and cross-App caller handling | Preserve Task attachment, caller correlation and claim ownership; no retained input route is stranded by removing the old pump |
| Removed conversation capability or optional timer | Task correctness and retained asks survive; degradation is visible without false completion |
| Reload, shutdown and old-consumer retirement | Cancel pending capacity waits, fence stale output and leave one response owner |

Report the actual scheduling/recovery paths removed, new hooks/branches/state,
retained compatibility cost and behavior sacrificed. Measure model calls on idle
ticks, queue/claim delay under mixed input and bounded scan/query cost. The goal
is lower total complexity and reliable follow-through, not fewer class names.
Run full Host CI for implementation PRs; model judgment and live latency require
separate authorized evidence.

## Documentation verification

This revision changes design only. Validation passes `bun run check:may-design`,
local Markdown links/anchors and `git diff --check`. No shared controller, system-input
route, migration or model-backed behavior is implemented or activated here.
