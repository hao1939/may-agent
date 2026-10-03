# Core Principles

**Supports:** [Design Philosophy](design-philosophy.md#how-to-decide-a-tradeoff). Turns value and cost reasoning into reusable technical decision rules.

**Choice basis:** [Design Philosophy](design-philosophy.md#how-to-decide-a-tradeoff).

**Design status:** Accepted.

These are the technical decision rules derived from our
[Design Philosophy](design-philosophy.md). Use them to judge a change; use
[System Model](../2a-design/system-model.md) for the current mental model and
the linked subsystem documents for exact contracts. An accepted direction is
not a claim that every implementation boundary is already separated.

For any design choice, first make the
[project goal](design-philosophy.md#define-the-goal-first) clear, then ask the
[fundamental question](design-philosophy.md#how-to-decide-a-tradeoff):
**What value does this provide, what does it cost, and is it worth that cost?**
Assess the [benefits and costs of each choice](design-philosophy.md#value-and-cost);
the same mechanism can produce both. Question expensive guarantees and
compare with a simpler alternative. The principles below guide mechanism
selection; they do not each demand the most elaborate possible implementation.

## Simple first

First ask whether the proposed feature can be removed while still satisfying
the outcome. Otherwise use the smallest sufficient mechanism. Before adding or
changing a mechanism, trace the existing capability that should already cover
the case and test its real boundary. Repair or delete conflicting wiring and
interpretations before adding a framework, protocol, configuration layer, or
work lifecycle. A genuine missing primitive should be recorded separately from
an implementation defect.

When the established behavior is uncertain, inspect the owning source and
current design, then consult relevant retained research or established external
practice. State what that evidence does and does not establish; borrow the
small invariant that fits this system rather than importing another system's
framework. Simplicity includes the decisions, handoffs, and recovery paths
needed to operate the system, not only code size.

Sufficient includes [robustness for the actual need](design-philosophy.md#robust-enough-for-the-goal).
Remove fragile dependencies and unnecessary state first. Add protection where
the avoided disruption justifies its implementation, operating cost, and new
failure paths. Extra compute or storage may keep the design simple and robust.

Compare implementation and maintenance complexity with expected execution,
failure, and redo costs. Accept extra computation or latency when that is
cheaper overall than machinery to avoid it. Match the
[time horizon and risk](design-philosophy.md#match-the-horizon-and-risk) to the
choice: recurring costs matter more for a frequently used foundation; a trial
should earn its next investment through useful results or learning. Reassess
when a trial becomes regular use. Favor quick experiments when mistakes are
affordable; increase evidence and protection as the cost of being wrong rises.

Test the uncertain part with a small experiment. Add structure when evidence
shows what failure it prevents; known correctness requirements can justify it
immediately. When a fix grows through repeated special cases, reconsider the
feature or guarantee causing it. A simpler contract with acceptable limitations
may be better than a more elaborate implementation of the old one. Change the
owning contract and affected consumers together; do not claim a guarantee that
the system no longer provides. See [When a fix keeps growing](design-philosophy.md#when-a-fix-keeps-growing).
See [Evidence First](evidence-first.md) and [Mechanism Selection](code-vs-data.md).

## Stable core, replaceable capabilities

Keep stable guarantees in a small core: App registration and input admission,
Events, State and storage, and Work runtime. Shared timing and failure
containment support those responsibilities. Grow capability through Apps,
executors, producers, interfaces, and specialized
reports that use those contracts. Adding an implementation should normally
change its module and composition wiring, not core lifecycle or state rules.

Removal should degrade capability while preserving the remaining system's
correctness and accepted obligations. Without a required executor, affected
work remains visible and cannot claim completion. Removing an interface must
not stop unrelated Tasks. Removal may require draining work first.

External means outside this stable responsibility boundary; an adapter may
live in the same Host, process, and repository. A needed capability can have a
replaceable implementation. Shared code is not automatically core, and stable
does not mean frozen. The [architecture](../2a-design/architecture.md)
owns these boundaries and the behavior required when a capability is absent.

### Contain failures; keep default capabilities simple

Execution boundaries preserve failure evidence, clean up resources, apply bounded
known-safe responses and expose truthful outcomes. Code executes predictable
rules; the App's worker judges uncertain causes and how to proceed. The
assigning owner judges scope and whether more work is worthwhile. A worker
can report failure honestly; abandoning the assignment belongs to its owner.
The [Task lifecycle](../2a-design/task-resource-engine.md#one-lifecycle-baseline)
uses backoff to pace unfinished work without a fixed failure-count stop.
Its [deeper PoC review](../archive/reviews/controller-poc-deeper-review.md)
examines continuing-retry cost and owner decisions in use.

Useful default error handling and metrics remain product goals. Being provided
by default does not by itself put a capability in core. The expanded core-metrics
draft, simple `onError` event alternative, and App placement discussion are
[archived for later review](../archive/reviews/error-handling-and-conversation-discussion-20260910.md). They do not
require a new framework, mandatory collector, or App merger now.

Keep current work focused on simple, robust execution: one authority for work
and results, bounded attempts, explicit waits and cancellation, and safe restart
behavior. Prefer affordable safe redo when preserving progress adds more cost.
Measurement or investigation failure must not roll back accepted work or mask
the original failure. Existing [metric contracts](../2a-design/metrics.md) remain
in force while their default placement is reconsidered.

## Solidify the common 20%; teach the remaining 80%

This Herdr Supervisor heuristic guides what belongs in code; the percentages
are not a feature quota or a correctness target. Build a small, reliable
foundation for observation, validated actions, identity, state, and wakes.
Let the agent interpret varied situations using current facts and trusted
knowledge. One unusual incident need not become a new runtime branch.

Before adding behavior, check whether the existing capability, trigger, and
context are sufficient. If they are, use them. Add a missing deterministic
primitive or improve guidance at the responsible layer. An optimization needs
measured benefit that outweighs its new state, paths, races, and maintenance.
See the [agent-first test](code-vs-data.md#before-adding-runtime-behavior) and
[Herdr evidence](../archive/reviews/design-philosophy-history-20260909.md#lessons-from-herdr-supervisor).

### Code executes and brings back evidence; agents judge

Execution includes the feedback loop, not just starting an action. Code collects
information, responses and signals; tracks operations and their reported
progress; preserves outputs and failures; and makes relevant evidence available
to the responsible agent. The agent should not have to manage routine polling,
output discovery or a separate tracking registration after starting work.

Keep the agent's activity model small: execution can be running while results
are outstanding. Continue useful independent work; yield when only results
remain. Supported capabilities supply correlation, notification and recovery
mechanics. The agent requests an outcome and understands whether its result is
complete, pending or failed; it need not select an infrastructure lifecycle.
Direct tools still return directly. See
[execution and outstanding results](../2a-design/system-model.md#execution-and-outstanding-results).

The agent judges what the facts mean, whether a result is sufficient and which
authorized action comes next. Independent facts and Conditions coexist; reject
an action only when a requirement of that action is not satisfied. Historical
evidence identity is provenance, not continuing authorization by itself. For assigned work, the worker decides how to
make progress; the assigning App, parent agent or human decides whether to
continue, revise or close the assignment. The worker may recommend that decision
without applying it to its own assignment. Code enforces identity, permissions
and predictable execution rules. A successful command is an execution fact,
not proof that the intended outcome was achieved.

Keep independent facts and decisions separate. Accepting a contribution does
not establish that the whole assignment is fulfilled; receiving input does not
by itself invalidate earlier work; an outstanding Condition does not require
all useful work to wait. Infra may derive bookkeeping and scheduling from the
explicit contract. A semantic connection between these facts needs an agent
judgment or declared App policy, rather than an implicit global rule. See
[accept work and continue what remains](../2a-design/task-attempts.md#accept-work-and-continue-what-remains).

These are two responsibilities in one work loop, not two new subsystems or a
ban on direct agent tool use. Executors and observers provide capabilities;
existing Host Events, State and Work runtime preserve and deliver their feedback.
See [execution feedback and wakes](../2a-design/execution-feedback.md#execution-feedback-and-agent-wakes)
for the concrete contract.

### Use ownership to simplify intervention

An assigned owner normally carries the promised outcome through execution,
verification and delivery. Helpers provide bounded work or capabilities; they
do not take over that outcome. Handover is recovery when the owner cannot
continue, not routine completion. An intentionally source-only Task may finish
at reviewed source, but a broader delivery promise retains an explicit
accountable owner and concrete next action until that outcome is delivered.

When the worker cannot make progress within its scope, bring the facts and
remaining options to its assigning owner. That owner can clarify the goal,
authorize a different approach, coordinate help, wait, or close the work.
An installation-selected supervisor can handle an unavailable owner when that
route is provided. It receives a problem to judge, not ownership of the original
Task or additional permissions merely by being called a supervisor.

Code preserves the obligation and enforces the chosen action. It need not infer
a repair strategy from silence, error counts, agent names, or historical
sessions. Explicit execution budgets and safe mechanical recovery still apply.
Prefer this division of responsibility to an expanding collection of automatic
rescue rules. See [intervention boundaries](../2a-design/system-boundary.md#ownership-and-intervention)
for normal handling, fallback, and the current implementation limits.

## Apps own meaning; the Host owns mechanics

An App decides what an input means, what outcome it owns, and whether one
bounded attempt completed that outcome. The Host validates and admits input,
persists state, schedules attempts, limits concurrency, recovers after restart,
and exposes observations.

Do not put domain policy in queues, adapters, sessions, or storage code. Do not
make App code manage leases, mechanical retries, delivery bookkeeping, or database
rows. An agent or App-authored procedure can choose a retry, repair or failover
as a recovery decision; infra executes it through the owning capability.

Domain policy can be deterministic code. A rule selecting a maintenance agent
or a benchmark is still App policy; a rule rejecting an obsolete attempt result
is generic Host mechanics. Agent names do not inherently grant privileges.
Trusted installation/tool policy supplies operational scope and execution code
enforces it. Existing name-based exceptions remain an
[implementation gap](../proposals/app-policy-and-host-boundary-cleanup.md), not
a reason to weaken current safeguards before their replacement is verified.

## Event-driven integration

Use meaningful events to connect independent producers and consumers. React
to a known state change at its source instead of repeatedly rediscovering it
through polling. Timed work, external sources without notifications, and
bounded recovery can still need timers or probes.

An event is the small interface for something that happened. A declared route
may translate it to App input, wake an exact task or Condition, or merely
observe it. Caller correlation is added only when someone expects a result. A
record-only fact is still valid when nobody needs to act.

Routing identifies responsibility and records relevant input or observations;
the responsible Task reconciles current state to decide the response. Small
deterministic resource updates and exact authorized controls can finish through
their existing writers. This requires neither a Task per event nor a reconciler
per record. Notifications of committed state prompt a reread, not automatic new
work on their source. See the [resource boundary](../2a-design/events.md#resource-responsibility-and-reconciliation).

Required input is accepted only by its explicit route. There is no generic
owner fallback for an unknown target or unhandled fact.

For observations and diagnostics, events carry facts; trusted App or agent
knowledge guides the response. Keep that guidance with its owner so it can
improve without changing event delivery. External event text and worker output
do not grant authority or become executable instructions.

Keep local calls and transactions for operations that require atomicity or
ordering. Events need an integration or diagnostic purpose; publishing every
internal step adds coupling and noise. Publication, admission, execution,
completion, and delivery are distinct facts. Slow consumers must not block
admission or unrelated work, and a passive subscription is not durable work
acceptance. Event-driven design does not require an event-sourcing rewrite.

See [events.md](../2a-design/events.md).

## One authority for each resource

A conversational Request is an accepted ask that May must close the loop on.
Host input-handling rows track input handling and caller correlation;
accepted Request records track the ask and its closure. Completing one must
not imply completing the other. [Message Lifecycle](../2a-design/message-lifecycle.md)
owns that distinction.

A bounded turn may finish authorized work directly. An App Task preserves an
independent outcome across attempts; it owns execution, waits and results.
Request tracking must not copy that lifecycle.

An App action is only a named, validated way to create a request. A hierarchy
shown in a UI is only a read-only arrangement of Tasks by their declared
relationships. Neither is another work lifecycle or state authority. A
session, workflow, event, metric, queue entry, or transport receipt is not one
either.

When a Task needs another Task's result, describe the work through typed App
input. The Host preserves the exact return link. The parent can do useful
independent work while that result is pending, and release execution when it
needs only to wait. Relevant input can wake the assigning Task again, including
human discussion or the delegated result. Conversation is its human-facing role;
it adds no execution lifecycle. Both Tasks may belong to May. Another App is
useful for existing ownership, required authority, or expertise. The
[common-lifecycle proposal](../archive/reviews/conversation-input-unification.md)
owns this accepted direction and its current implementation limits.

See [work-model.md](work-model.md) and
[agent-app.md](../2a-design/agent-app.md).

## Context is discovered, not dumped

Present information in layers: current assignment and accepted requirements,
then the current state of explicitly focused work, then references to supporting
detail and history. The Host preserves complete information and supplies exact
reads; agents choose what to explore. A summary must expose its identity and
limits, so omitted detail remains discoverable. Continuity lives in durable
App/project/task state and session evidence, not an ever-growing default prompt.

See [sessions.md](../2a-design/sessions.md) and
[skills.md](../2a-design/skills.md).

## Match the mechanism to the responsibility

First decide what is owned:

```text
accepted human ask                -> Request with an eventual outcome
independent ongoing App outcome    -> Task, linked to the Request when present
changed or observed state only     -> fact
```

Then decide how one bounded attempt runs:

| Need                                                | Smallest suitable mechanism         |
| --------------------------------------------------- | ----------------------------------- |
| Deterministic calculation or adapter                | TypeScript helper                   |
| Context-dependent judgment                          | Agent, optionally guided by a skill |
| Stable ordering, branching, limits, or verification | Workflow                            |
| Mechanical detection                                | Observer, guard, or metric          |

Prefer a reusable skill over another agent when guidance is all that is
missing. Delegate when domain context, independent judgment, isolation, or
parallel execution justifies it. Encode predictable mechanics in tools and
workflows; keep contextual decisions with the responsible agent or App.

Use the same event-driven Task lifecycle for ordinary work, maintenance and
Conversation. A bounded Turn can finish authorized work directly; its stable
conversation Task remains available. An accepted outcome does not require the
Task to close. The App, parent agent or human decides when to close it, and the
Host enforces that decision without judging responsibility lifetime. Timers are
optional input; quiet Tasks need no running agent. The accepted
[baseline](../2a-design/task-resource-engine.md#one-lifecycle-baseline) is implemented
in merged Host #158; this does not establish deployment. Neither tool use nor frequency alone requires a workflow or a
new work mechanism.

An App becomes more powerful by adding domain policy, acceptance checks,
learned workflows, and bounded capabilities available during reconciliation.
Those extensions must not add App-owned storage, workers, schedulers, mechanical
retry controllers, process recovery, or delivery paths.

## Separate triggering, execution, and recovery

Schedules and observers supply input or facts. The Task runtime preserves the
obligation and decides when an attempt is eligible; the executor performs one
bounded attempt. Disabling optional schedule registrations must not disable
already admitted work or the timing needed for recovery.

Store accepted work before execution. Preserve its identity across waits,
cancellation, and restart; reject stale attempt results. Recovery restores the
same obligation; it need not resume the interrupted execution at the same step.
Keep hot-path work and recovery reads bounded to the affected resources. A
durable wait should release execution capacity rather than keep a session alive
solely to wait.

### Prefer redo when it is simpler and affordable

Restart a retry-safe attempt from its input or a coarse boundary when the redo
cost is acceptable. Preserve intermediate progress only when avoiding repeated
work justifies checkpointing, restoration, and their maintenance. Consider how
often interruption happens, the time and provider cost of redoing work, and the
complexity and failure modes of resumption. Precise resume is an optimization,
not a universal core requirement.

Retain the state needed for correctness: accepted input, Task identity, accepted
results, and evidence needed to handle committed effects safely. A retry may
recompute a report or repeat a read. If an external action may already have
happened, check its result or use its existing idempotency contract before
repeating it. Cheap computation does not make duplicate effects acceptable.

See [Task Engine](../2a-design/task-resource-engine.md),
[Runtime](../2a-design/runtime.md), and [Scheduling](../2a-design/cron.md).

### Safe retry by default; explicit exceptions

Make retrying the same operation safe by default. This reduces agent bookkeeping,
duplicate effects and human rescue while preserving continued work. Infra owns
routine retries, backoff, operation identity and replay under the existing
execution policy. Agents may also choose retry, repair or failover as recovery
decisions; they need not wait for automatic retries to end. Infra executes those
decisions with the same authority, effect-safety and execution bounds.

Use the simplest sufficient protection at the operation's owner. Reuse accepted
work and committed effects; repeating cheap computation can remain acceptable.
When safe retry is unavailable or disproportionate, disclose the specific
operation's exception, its consequences and recovery options. A default design
rule is not proof that every installed capability fulfills it. Keep recurring
failures observable so an agent can judge whether a different approach is needed.
This adds no universal retry-count limit or automatic Task pause.

The [Host/App retry and recovery contract](../2a-design/system-boundary.md#retry-and-recovery-ownership)
owns the detailed responsibilities and exception handling. See the
[mechanism guide](code-vs-data.md#decision-guide) when deciding between a shared
execution repair and an App-owned recovery procedure.

## Metrics are observations, not decisions

Metrics expose health, progress, and blind spots. A breach is evidence for the
owning App to interpret, not automatic proof of failure or permission to
mutate work. Pair activity measures with outcome evidence where useful, and
retire metrics whose meaning is weak.

See [metrics.md](../2a-design/metrics.md).

## Interfaces present shared state

Console and Telegram append to and render the same Conversation resource.
May's persisted result completes semantic work and becomes conversation
content. Each adapter chooses an appropriate presentation and independently
tracks transport attempts; adapter delivery never gates or rewrites the work.

See [human-control-surfaces.md](../2a-design/human-control-surfaces.md).

## Convention over configuration

Extend locally; integrate by contract and convention. A new capability should
normally add its implementation, composition wiring and owned guidance without
adding another ownership, tracking or execution system.

- **Contract:** the small, validated boundary for actions, facts, identity,
  evidence and responsibility.
- **Convention:** the normal way participants make those facts discoverable,
  such as a known metadata field carrying the owning Task identity.
- **Agent knowledge:** trusted guidance for interpreting the facts and choosing
  a response; its interpretation stays with the agent, not the delivery path.

Herdr's `event-watchd` demonstrates this with a goal ID on a PR or build. A
shared observer discovers the link without a per-resource register, renew or
unregister lifecycle. The relationship still exists on the resource; the
convention removes separately managed subscription state, not ownership.
May can use its existing exact Task event route for this pattern; it does not
need Herdr's daemon or native-session delivery path.

Keep one authoritative home for each fact. A discovery cache may remember a
resource and revision, but must not become an independent ownership registry.
Conventions need readable examples and boundary validation; ambiguous or
untrusted metadata must not silently choose work. Use existing explicit routes
when a shared or read-only resource cannot carry one owner.

Conventions also determine locations and defaults. Executable behavior still
has one typed, validated declaration: one `app.ts`, one `defineApp`, and one
atomic App generation. Do not add a second loader, service locator or implicit
route merely to avoid a small declaration.

Use ordinary imports and narrow typed dependencies. Composition chooses and
connects concrete adapters; core code depends on their contracts. Keep App
policy local and expose only needed capabilities through the SDK. A new folder
or interface proves little until replacement or absence preserves the contract.
See [Architecture](../2a-design/architecture.md) for the current code map.
The [observer convention](../2a-design/agent-app.md#resource-ownership-by-convention)
applies this rule to provider integration. The extension test is: can the next
source join the existing work loop through its adapter and guidance, without
changing core lifecycle rules? Add another mechanism only for a demonstrated
capability, trust or lifecycle need.

## Fix the layer that failed

When behavior is wrong, inspect the complete causal path:

1. the request and context the model saw;
2. authoritative App, task, and session state;
3. runtime admission, scheduling, concurrency, and recovery evidence; and
4. external provider or transport evidence.

Fix the layer that violated its contract. Prompt problems are common, but so
are stale state, incorrect scheduling, resource pressure, and adapter faults.
Do not assume either the model or infrastructure is guilty before checking.

For a mechanical invariant, use code, schemas, or transactions. For missing
knowledge, context may suffice; for a repeatedly missed sequence, a workflow
may help. Behavioral detectors need evidence of usefulness and false positives
before they block work. Do not add broad restrictions or more prompt rules to
hide a failure in another layer. See [Mechanism Selection](code-vs-data.md).

## Review rule

Use the philosophy when a decision can change the work, its scope, or its cost.
Existing features and contracts face the same comparison as new ones.

| When                                                      | How to use it                                                                                        |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Choosing work or a design                                 | Identify the unmet goal and compare the proposed work with a simpler alternative or leaving it out   |
| A fix keeps growing                                       | Reconsider the feature or guarantee driving the complexity before adding another mechanism           |
| Reviewing a proposal or PR                                | Test the claimed benefit, lifetime, costs, and failure assumptions against evidence and alternatives |
| An experiment gains regular use, or actual results differ | Reassess cumulative cost and robustness; harden, simplify, or retire what the evidence warrants      |

For a meaningful tradeoff, answer the relevant questions:

1. **Goal:** What outcome is sufficient, and what evidence would show it?
2. **Alternative:** Could deletion, reuse, a narrower contract, or an existing
   agent capability meet that need more simply?
3. **Value and cost:** What do we gain and give up over likely lifetime and
   usage, including maintenance, execution, and human attention?
4. **Risk:** What if we are wrong, who or what is affected, and how costly is
   reversal? What protection or experiment is proportionate?
5. **Decision:** What is the smallest worthwhile next step, how will we verify
   it, and what evidence would make us finish, change course, or invest further?

Then consult the technical principles relevant to the affected boundary:
ownership and authoritative state, capability removal, events versus calls,
redo versus retained progress, or conventions. A recommendation should explain
the concrete consequence and a feasible alternative. Naming a principle alone
does not establish that a design is wrong; evidence can justify a different
choice.

Record material reasoning once in the existing proposal, task context, or PR.
The Host PR template's **Purpose**, **Change and design**, and **Verification**
sections already provide places for it. A useful decision note can be brief:

> To achieve [outcome], choose [A] over [B] because [benefit] justifies [cost]
> at [expected usage/lifetime]. Accept [limitation or risk]. Verify [evidence];
> revisit if [assumption changes].

For an agent task or review, supply the project goal, relevant evidence, and a
link to this guide. Read deeper where the decision needs it. Routine obvious
edits need no separate write-up, and this guide creates no new approval gate,
scorecard, or automated enforcement of preferences.

After implementation, check whether the promised improvement occurred using
existing tests or operating evidence. If it did not, revise the choice and
remove machinery that no longer earns its cost. The philosophy is useful when
it improves decisions and outcomes; its own documentation and process cost
must earn their place too.

## Resolve conflicting designs

Use the [design hierarchy](../README.md#design-hierarchy) to find the common
purpose behind the competing choices, and the
[philosophy's tradeoff rules](design-philosophy.md#how-to-decide-a-tradeoff)
to decide between them. A proposal's recency, larger feature set or use of the
word "simple" does not establish that it is better.

1. **Locate the actual disagreement.** Name the affected contract, scope and
   shared parent requirement. Distinguish an incompatible promise from different
   implementations, a source defect, a historical record or a deferred proposal.
2. **Agree on enough.** Compare against the same useful outcome, authority,
   workload and expected lifetime. Current human requirements can refine the
   goal; neither proposal may quietly strengthen or narrow it for convenience.
3. **Apply philosophy and conventions.** Start with deletion or reuse and the
   simplest sufficient contract. Follow existing ownership, judgment, execution
   and calling conventions. Explain which rule applies and its concrete effect;
   citing "agent decides" or "robustness" alone does not choose an implementation.
4. **Compare consequences.** Consider outcome quality, human effort, recurring
   cost, maintenance and failure behavior. State any convention exception, its
   benefit, accepted cost and evidence. If the answer depends on an unknown,
   use a bounded investigation of that unknown instead of combining both designs.
5. **Record one decision at its owner.** Explain the selected option and why,
   what remains uncertain, and when to reconsider. Link affected proposals to
   that decision and mark superseded scope explicitly. A draft remains a draft;
   an accepted change updates the owning contract and affected consumers.

For example, both exact step resumption and restarting from retained inputs can
support work surviving interruption. The parent requirement is continued useful
work with acceptable redo cost. Cheap repeatable work may favor restart; costly
or consequential effects may justify retained receipts or checkpoints. The
philosophy chooses the sufficient behavior for the actual workload; the existence
of a resume mechanism does not itself make precise resumption a requirement.

Keep the reasoning brief in the existing proposal or decision record:

> Supports [parent outcome]. Following [philosophy/convention], choose [A]
> over [B] because [evidence and benefit] justify [cost]. Accept [limitation];
> reconsider if [assumption changes]. This [preserves/proposes to change]
> [owning contract].

This is a reasoning convention, not another approval gate or scoring system.
