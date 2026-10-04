# Execution feedback and agent wakes

**Supports:** [Events and Task admission](events.md). Makes useful execution facts available for judgment without turning every progress update into a model call.

**Choice basis:** [Code executes and brings back evidence; agents judge](../1-principles/core-principles.md#code-executes-and-brings-back-evidence-agents-judge).

**Design status:** Accepted.
**Implementation status:** Execution facts use existing event, diagnostic and Task-input paths. Deduplication and wake rules below describe source contracts; a delivered fact does not establish agent consideration.

Use [Events](events.md) for publication, routing and durability. This chapter
owns the decision boundary between retaining progress and waking a responsible
agent. [Metrics](metrics.md) owns trend observations; the App judges their meaning.

## Execution feedback and agent wakes

Code executes and maintains the feedback loop; the owning agent judges meaning
and the next action. These responsibilities reuse existing resources:

```text
agent chooses an authorized action
  -> executor runs it; observer follows external state when needed
  -> execution/resource evidence records progress, output and result
  -> relevant fact enters existing durable Task admission
  -> the same Task receives the evidence and judges what to do next
```

Task-owned execution inherits the Host's App, Task and attempt identity.
External resources use the adapter's documented ownership convention. A
resource ID, attempt ID or session ID is evidence linked to work, not another
work owner. Facts about shared resources can use existing Condition or App
routes instead of inventing a single Task owner.

A feedback fact identifies the source resource or operation, what was observed,
when it was observed, and the relevant source revision when available. It uses
the existing target and correlation fields and links to bounded evidence.
Large output, reports and debug details remain with the execution or resource
record; events and Task summaries reference them rather than duplicating logs.
Do not invent progress percentages, success or freshness when the source does
not establish them. A provider read failure is not proof its operation failed.

### Record progress; wake for reconsideration

| Observation | Normal handling |
| --- | --- |
| Log output or ordinary reported progress | Retain with the run and expose to readers; no agent turn for each line or heartbeat |
| An awaited operation finishes, fails or needs input | Record the result/evidence and route feedback to the responsible Task |
| A linked resource's configured relevant fields change | Publish the observed revision to its owning Task; the agent judges its significance |
| Infra checks a pending Condition | Recover retained observations and exact saved results in code; an unchanged wait invokes no agent |
| An agent-selected Task `reviewAt` becomes due | Reconsider the work once; elapsed time alone proves neither success nor failure |
| New actionable input arrives while the Task is running | Preserve it through existing Task admission and pending-input handling; do not start a competing session |

An immediate tool result already available to the active attempt does not need
a second event to wake that same attempt. Likewise, progress emitted by an
attempt is not an automatic self-wake. Asynchronous feedback reuses exact Task,
dependency or Condition routes; it does not require a supervisor relay or an
adapter calling the model directly. Closed, cancelled and superseded work
remains subject to existing Task lifecycle rules, not provider metadata.

Scheduling hints may coalesce; accepted input and outcome evidence follow
their existing persistence and retention rules. Polling an unchanged provider
should not repeatedly invoke judgment merely to rediscover the same state.
Adapters declare which source fields matter, while the agent decides their
meaning; no central table of provider-specific repair strategies is needed.

The shared Task runtime applies this to typed delegation:
`project.task.reconciled` and `app.task.cancelled` refresh saved input feedback
and linked Conversation observations. `app.dependency.updated` carries the exact
input's first accepted failure (`blocked`) or its answer/owner closure (`done`).
A blocker wakes the caller with evidence but keeps its wait and input unfinished.
The saved report suppresses repeated retry notifications; routine waits do not
relay caller wakes. Recovery uses the same saved evidence and Condition path.
See the [first slice and limits](../archive/reviews/conversation-input-unification.md#first-caller-feedback-slice).

When execution resumes, supply a bounded view of the objective, changed facts,
current work/waits and evidence references. The agent can read deeper using
existing Task and execution readers. Keep response guidance with its App or
agent, separate from untrusted external output. A wake is a request to
reconsider current evidence, never acceptance proof or new authority.

### Duplicate delivery and safe reconsideration

Duplicate delivery is expected, including worker relay retries, recovery after
restart, and delayed copies arriving after an attempt has accepted its result.
Producer restraint and receiver idempotency are complementary requirements.
Neither relies on exactly-once transport.

- **Producer:** reuse a stable publication identity for the same fact or result.
  A fact already available to the publishing attempt does not automatically
  require another attempt. Do not notify merely to acknowledge a duplicate and
  create a feedback loop. Keep observations distinct when their source revision
  or meaning actually changes.
- **Host receiver:** recognize the same durable event for the same Task across
  pending input, claim, settlement and restart. Receipt identity survives removal
  from the pending queue. A repeated delivery acknowledges that existing receipt;
  it does not append fresh input, resubmit old desired state or create another
  model turn. Active attempts also suppress repeated live hints for claimed,
  consumed or already-delivered input; each listener still receives new input.
  Receipt and Task changes share a durable boundary. One Task's receipt cannot
  consume another Task's input.
- **App receiver:** different event identities may describe the same business
  fact. Compare current source evidence with retained Task results and operation
  identity before acting. If nothing remains, return a bounded no-op without
  repeating effects, notifications or progress increments. Preserve unrelated
  input, outstanding waits and genuinely changed state. Delivery order alone
  does not establish source freshness.

Receiving input is not accepting an outcome. Claiming or remembering its
identity must not discard unfinished input: a failed, invalid or interrupted
attempt recovers from its retained batch and pending input. Accepted results
and incorporated input settle through the existing fenced transaction. A
worker's self-addressed publication is durable before relay; when its valid
result consumes that fact, a late first relay or repeat cannot revive it. A
retry that returns an existing publication receipt has the same handling rule.

Journal recovery preserves the stored event ID, so readback and delayed delivery
refer to the same input. A consumed event stays quiet unless it matches a current
open Condition under the existing freshness and report-revision rules. This lets
a newly declared wait use retained evidence without waking again for an already
satisfied wait. Condition and input changes use the same fenced transaction.
See [Task event input](task-resource-engine.md#event-input-and-checkpoints).

For an external action, use the destination's idempotency key where available,
or read back operation state before retrying an uncertain result. There is no
atomic exactly-once guarantee across arbitrary external systems and Task
settlement. Record unresolved ambiguity; never infer that a failed attempt
means its external action did not happen.

Correctness means no repeated effect or false progress from an already-handled
fact. Avoiding unnecessary attempts is a separate efficiency goal. A harmless
extra reconsideration can be correct; repeated self-wakes without new work are
still a defect worth removing. These rules apply to ordinary Tasks, including
periodic reviews; they do not require a special owner-review controller.

**Implementation status:** Host [PR #175](https://github.com/hao1939/may-agent/pull/175)
merged as `e38d2861` with receipt retention and self-publication handling.
It builds on merged Host #168: `attempt-execution.ts` owns publication receipt
capture and live-listener filtering; admission and storage retain exact delivery
identity across attempts. Admission, storage, publication tracking and worker
relay share target parsing, including the supported project alias and surrounding
whitespace. The existing fenced reconciler still owns settlement.
Its focused regressions cover duplicate admission during execution, after
acceptance/restart, delayed child-process relay, and journal readback for a newly
declared Condition. This is not a claim of
installed-container adoption or universal App-level semantic deduplication.
The [pilot record](../archive/reviews/may-project-review-pilot-20260912.md)
keeps validation and rollout evidence separate.

### Observation is not successful publication

An adapter must not mark a notification handled merely because it read the
provider. If persistence fails or a replaced observer's result is discarded,
the next eligible observation must still be able to report the current state.
After durable admission, existing Host recovery owns the accepted work.

Prefer safe re-observation and existing correlation over a second queue. If
change suppression needs a checkpoint, distinguish observed state from
successfully published feedback and advance the latter only at its durable
boundary. Periodic level facts can be simpler, provided consumers suppress
duplicate obligations and unnecessary execution. This is not an exactly-once
delivery promise or a requirement to retain every intermediate provider change.

**Implementation boundary:** May already has observer execution, exact Task
admission and durable Task input recovery. This refinement does not claim a
shared provider-discovery adapter exists. The Host now owns an observer's
`previousObservation`/`nextObservation` snapshot and advances it only after the
returned facts receive durable publication receipts; the reviewed Scout
credential observer uses that contract and no longer advances a module-local
publication checkpoint. Provider discovery still has to distinguish a successful
empty read from total read failure so the existing `app.observer.failed` path can
run, and an installed App subscription or exact Task route must own any semantic
consideration. Emitting or logging the failure alone is not evidence that an
owner considered it.
