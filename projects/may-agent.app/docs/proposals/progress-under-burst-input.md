# Make progress while input keeps arriving

**Supports:** [Task attempts](../2a-design/task-attempts.md). Turns admitted intent into useful results without waiting for the inbox to become quiet, supporting [May's purpose](../1-principles/purpose.md) of decreasing supervision and acceptable total cost.

**Choice basis:** [Simple first](../1-principles/core-principles.md#simple-first), [agent judgment and infra admission](../2a-design/task-attempts.md#agent-judgment-and-infra-admission), and [input during execution](../2a-design/execution-contributions.md#input-during-execution).

**Design status:** Proposed for review. The steering boundary below needs an explicit contract choice.
**Implementation status:** Isolated deterministic experiment only, based on Host `438ad1e38` (merged #297). No deployment or model trial. [Trial and counterexample](../archive/reviews/burst-input-progress-20261003.md).

## Recommended direction

An attempt should complete a useful, bounded piece of the accepted work while
later input remains accountable. An empty inbox is not a prerequisite for
progress. New input does not, by itself, prove that the current decision is wrong.

One Request can still represent one intention with several messages and revised
requirements. The agent can consider them together, request help and run tests
in one attempt. This proposal does not create a Task or attempt per message.

The agent judges what belongs together, what changed, which work is now useful,
and which inputs it has fulfilled. Infra supplies and records that scope,
checks authority and exact revisions, applies admitted changes, and retains
everything not addressed. Task status is derived from all remaining work; a
useful accepted result need not close the Task.

## Ordinary example

The user asks for a report. An attempt reads the current requirement, works on
the report and requests review. While it works, another worker reports test
results and a new unrelated question arrives. The report and its legitimate
review request should be saved, the newer inputs should remain pending, and
the next useful pass should consider them. The report should not need to be
re-created merely because input arrived before its finish.

If a new message changes the report's requirement, the agent updates that same
Request and reuses the still-valid draft and tests. Infra checks the affected
revision. It does not infer a semantic conflict from the existence of another
message or erase useful work. Explicit Stop/cancellation retains its immediate
execution-control meaning.

## Three boundaries that must remain distinct

| Boundary | Meaning and responsibility |
| --- | --- |
| Input received | Infra durably queues the message and signals the owner. Receipt is not a fulfilled request or an interpreted requirement change. |
| Requirement understood | The agent decides whether it is another part of the same intention, a correction, independent work, evidence or a control request. The resulting accepted Request/Task change carries its existing identity and revision. |
| Work applied | Infra admits the decision against the considered input and current affected authority. It records the exact result, actions, outstanding Conditions and remaining inputs atomically where the existing contract requires it. |

The current all-input fence conflates arrival with invalidation. Replacing it
requires clarifying these boundaries, not guessing that all system events are
harmless or all human messages conflict. Either source can carry important facts.

### Steering and the unavoidable tradeoff

There is no finite finish point if every later arrival requires another complete
review, and arrivals never stop. Conversely, accepting an old prepared action
without interpreting a correction can perform work the user no longer wants.
The experiment reproduces both sides of this tradeoff.

Recommended convention: use bounded input snapshots at natural execution
boundaries. The agent incorporates available steering before choosing its next
meaningful action. Infra binds the decision to that considered scope; later
ordinary input stays pending for a subsequent boundary instead of repeatedly
extending the same decision. Stop and accepted cancellation/revision invalidate
affected authority through their existing controls. They are not ordinary
background messages waiting for an empty inbox.

This convention permits a result for the previous understood requirement while
a newer ordinary correction is still queued. It must be visible as a scoped
result with pending input, not as a claim to have handled the latest message.
An unread free-text “do not do that” cannot simultaneously be promised immediate
semantic effect without a mechanism to interpret it. Live delivery alone does
not prove it was considered. Do not document that guarantee.

For an action whose authority depends on current approval or withdrawal, retain
the relevant fresh authorization check and an opportunity to process human
steering before dispatch. If the accepted requirement keeps changing, postponing
that action can be correct; preserve drafts and independent progress. Guarantee
progress for stable authorized work, not completion of continuously contradictory
instructions. A blanket deletion of the existing fence is not the proposed fix.

## Break the two observed cycles

### Repeated “done” with outstanding inputs

This has a separate cause from arrival-based rejection. The
[Task context contract](../2a-design/task-attempts.md#result-contract) preserves
previous-result coverage and makes earlier unanswered work visible. It keeps
`inputKeys: []` valid for useful partial work. A small real-model trial completed
the requirements on both baseline and candidate; see the
[evidence and remaining limits](../archive/reviews/unfinished-input-context-20261003.md).
The large-backlog case remains unverified, and additional repetition policy is
deferred. This context repair does not change the unseen-input fence below.

### Repeated proposals rejected by fresh input

Accept the addressed contribution without implying the whole Task is finished.
Preserve later messages, independent Conditions and exact result identities.
Reject a stale generation, cancelled attempt, changed affected Request revision
or other failed action requirement; do not use unrelated inbox growth as the
reason to discard all proposed progress.

During-attempt actions and actions returned at finish need the same rules.
Fixing only the final result path would leave request admission and immediate
actions vulnerable to the same starvation. Existing atomic result/action
admission remains: do not publish “review requested” if the request was rejected.

## Reuse existing mechanisms

| Needed behavior | Existing foundation and work to assess |
| --- | --- |
| Collect pending inputs in one wake | Durable input, one Task queue entry and the bounded claim already exist; no new debounce queue. |
| Record what this decision considered | Existing claimed/continued input IDs and accepted live input. Review usability across direct agents, workflows and Conversation; do not make agents manage delivery watermarks. |
| Apply only still-valid work | Existing attempt/generation, Request revision, target-action and approval checks. Review broad pending-input checks at completion, running changes and dependency admission together. |
| Continue with new requirements | Same Request/Task and the next bounded attempt; retain accepted artifacts, actions and receipts. |
| Wait economically | Existing exact Conditions and explicitly chosen Task review deadlines. Samples and unchanged pending facts do not imply a model review. |
| Detect repeated non-progress | Existing usage, Task evidence, metrics and Evaluation. App policy judges recurrence and useful outcomes; infra records facts and delivers the breach/decision. |

Evaluation should distinguish work accepted, inputs fulfilled, useful artifacts
produced, genuine waits established and interventions actually applied. Counts
of successful attempts alone are misleading. No changed input count is a signal,
not proof of waste: a long computation can still produce useful intermediate work.

## Burst handling and sustained overload

Handle the pending batch together when it fits; choose a useful bounded slice
when it does not. A short collection window may improve measured efficiency,
but waiting indefinitely for quiet reproduces the original problem. Do not add
a timer before measuring a need; current wakes already coalesce.

Preserve every distinct requirement. Code may deduplicate exact replay or use
an explicitly defined superseding observation; an agent judges whether two
free-form asks are redundant. “Latest message wins” cannot safely replace a
cumulative request.

If accepted work arrives faster than it can be completed, the backlog grows
even with correct settlement. The owner must prioritize, narrow scope, defer
with an accountable decision, or add suitable capacity. More retries cannot
solve insufficient capacity. Preserve service for older eligible requirements
and human steering; a stream of new work must not silently starve old work.

## Alternatives and why

| Choice | Benefit | Cost or failure |
| --- | --- | --- |
| Require a quiet inbox | Simple conservative admission | Demonstrated zero accepted progress under continuous arrivals; finite bursts amplify repeated context. |
| Drop the pending-input check everywhere | Immediate progress in the experiment | Demonstrated obsolete handoff after an unread correction; inconsistent with other action paths. |
| Delay until a burst ends | Can combine a finite burst | Adds latency and has no completion boundary for sustained input. |
| Add a separate intake agent | Could interpret changes while workers execute | Adds model work, concurrency and another handoff; current Conversation and live-input facilities should be tested first. |
| Bounded decisions against accepted scope | Preserves useful work and queues later input | Requires explicit steering semantics and consistent checks across execution paths. Recommended direction. |

## Next bounded investigation

First settle the ordinary-message versus explicit-interruption convention, then
test the smallest implementation through existing admission. The current PoC
is a contract probe, not a candidate to merge. Required cases include:

- stable work advances while unrelated human/system input keeps arriving;
- a requirement correction revises the same intention and reuses valid work;
- explicit Stop, approval withdrawal and affected revision changes still fence
  stale actions, including during-attempt calls;
- raw correction arriving around the chosen decision boundary has the promised
  behavior, without claiming unread input was considered;
- many inputs bound to one Request can be fulfilled together, while independent
  and overflow inputs remain pending through restart;
- real progress can coexist with Conditions and an open Task;
- successful empty-scope repetition reaches a useful owner decision without
  suppressing legitimate partial progress or silently abandoning requirements;
- overload remains visible and older work receives service.

Portable deterministic tests establish bookkeeping. A later separately
authorized model trial should compare fulfilled outcomes, correction latency,
oldest outstanding input, attempts per useful result, and token use on the same
burst. Do not claim savings or good agent judgment from fewer synthetic attempts.
