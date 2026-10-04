# Work Admission And Mechanism Selection

**Historical context:** [Work Model](../../1-principles/work-model.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Accepted; incorporation complete; archive with migration closeout
**Scope:** Give App authors one semantic rule for choosing inbox, task, fact,
agent/skill, or workflow without introducing another runtime mechanism.

## Decision

Make two decisions in order. First classify the input by the responsibility it
represents and, when it creates work, choose its durable owner. Do not classify
it from the transport, event name, producer, or whether a caller is
synchronously waiting:

```text
independently correlated result   -> App inbox
desired-state identity that must
converge across bounded attempts  -> App task
changed or observed state         -> fact
```

Then choose how one bounded attempt is implemented:

```text
deterministic calculation or adapter -> ordinary TypeScript helper
bounded variable judgment            -> agent session, optionally with a skill
stable bounded orchestration          -> workflow
```

These are two dimensions, not competing alternatives. An inbox request may
complete directly, delegate to one child App, or attach to a task. An inbox or
task attempt may use ordinary code, invoke its owner directly, apply a skill,
or run a workflow. An observer may publish a fact that satisfies a Condition or
wakes deterministic task work. Composition does not transfer durable ownership
to code, a session, workflow, skill, event, observer, metric, or queue.

## Why this rule is needed

The canonical runtime already has explicit contracts for requests, tasks,
facts, sessions, skills, and workflows. The remaining ambiguity was authoring:
similar inputs could be modeled as per-event tasks, inbox requests, or standing
work without a shared selection test.

Source-based rules are insufficient. A scheduled slot may represent an
independently reviewable request, a deterministic wake for standing desired
work, or a mechanical observation. A project comment may ask for a distinct
result or merely add evidence to an existing task. The durable obligation, not
the source category, decides the route.

## Rule 1: inbox, task resolver, or fact only

Create an App inbox item when this App owes one independently correlated
result. The result may be asynchronous and no caller needs to remain connected.
Human input, App delegation, an action, an input schedule, or a fact translated
by a top-level App subscription may all create that obligation.

Route a fact through `tasks.subscriptions` and `tasks.resolve` when pure App
policy can deterministically declare or revise desired task work. A fact with
an explicit task target wakes only that task. A fact that creates neither a
request, TaskIntent, exact wake, nor Condition wake remains observation only.

An App may declare an exact `observations` selector when such a no-op is
intentional and reviewed. The host then records terminal observation acceptance
for the installed App generation. Without an actionable route or a declared
observation selector, the fact remains visible and unhandled. Neither case owns
work.

There is no `inbox.accepts`, `tasks.accepts`, or implicit fallback between the
two routes. One fact may be acted on by several Apps, but one App never derives
both an inbox request and a new or refreshed TaskIntent from it. If the request
also needs convergence, its inbox disposition may attach a task after
admission. Exact stored Condition wakes remain additive.

The diagnostic is:

> If the inbox item disappeared, would the App lose a distinct result it still
> owes?

If yes, retain the inbox item even when its disposition attaches a task or
delegates to one child App request. If no, and the only meaning is to refresh
known desired work, use the task route directly. If neither route owns work,
keep the input as a fact.

## Rule 2: when to attach a task resource

A task is desired-state identity across bounded attempts, not a generic
durability wrapper. Attach one when the App owns an outcome that needs one or
more of:

- repeated reconciliation against current evidence;
- stable desired-state identity revised or woken by multiple triggers;
- exact Conditions and later continuation;
- independently tracked decomposition or dependencies;
- other work or operators must address, revise, wake, or depend on the same
  desired outcome by stable identity; or
- a standing condition maintained over time.

Do not create a task merely because work is asynchronous, auditable, or must
survive restart. The App inbox already provides durable correlation and may
complete in a bounded owner attempt, delegate to one child App, or remain the
correlated parent while an attached task converges.

Observers do not complete work. They read external state and return facts.
Pure subscriptions translate those facts into an App input or TaskIntent, and
the owning inbox/task controller admits the resulting state change.

High-rate observations that describe one logical frontier should normally wake
one stable `maintain` task. Use per-item `achieve` tasks only when each item is
independently assigned, reviewed, depended on, or explicitly requested. Task
storage must not become a second event archive.

## Rule 3: how to implement one bounded attempt

Use ordinary App-local or shared TypeScript for deterministic calculation,
validation, formatting, and narrow provider adapters. A single deterministic
operation does not become a workflow merely because it is important or reused.

Use direct owner judgment when the correct approach varies materially with the
case. Extract a skill when the judgment method is reusable across turns or
contexts but the agent should still control how it is applied. A skill supplies
guidance; it does not own sequencing, retries, or a terminal result.

Use a workflow when a bounded sequence has become stable enough that code
should own its ordering, branching, limits, verification, and terminal-result
admission. Keep the work as direct owner judgment, optionally guided by a
skill, while the correct sequence remains contextual or is still being
learned.

Three successful runs are useful evidence of stability, not an admission
threshold. A known safety-critical protocol may deserve a typed, tested
workflow before its first production execution. Conversely, frequent work
does not deserve a workflow when each case still requires a materially
different sequence.

A workflow may invoke an LLM. Its workflow-owned behavior should be testable
without a live model by supplying fake agent responses and asserting schemas,
branches, limits, gates, verification, and result admission. A wrapper that
only calls an agent and forwards arbitrary prose adds no workflow value.

A workflow owns one bounded attempt. Durable waits and repeated convergence
belong to the enclosing App request or task; a later fact starts a later
attempt rather than resuming an in-memory workflow stack.

## Boundary examples

| Situation                                                          | Durable route                                   | Bounded implementation                          |
| ------------------------------------------------------------------ | ----------------------------------------------- | ----------------------------------------------- |
| A human asks for one unfamiliar repository review                  | correlated App inbox item                       | owner judgment, optionally using a review skill |
| Provider snapshots revise one deployment frontier                  | fact to one stable `maintain` task              | owner or bounded deploy-and-verify workflow     |
| A healthy snapshot is intentionally recorded with no action        | fact plus an App `observations` selector        | no execution                                    |
| Each scheduled digest slot owes an independently reviewable result | input schedule to App inbox                     | helper, owner, or workflow as appropriate       |
| Implement, test, and review becomes a stable bounded protocol      | existing inbox/task owner remains authoritative | typed workflow tested with fake agent responses |

## Incorporation

The accepted design carries each rule at its owning boundary:

1. `system-model.md` and `agent-app.md` define obligation-based routing and the
   complete mechanism map.
2. `task-resource-engine.md` defines when desired state deserves task identity.
3. `code-vs-data.md`, `skills.md`, and `workflows.md` define deterministic
   helpers, reusable judgment guidance, and evidence-based workflow promotion.

No SDK or infrastructure change follows from this decision. Existing Apps are
reviewed opportunistically as their routes or task models change; this decision
does not require a blind conversion sweep.

## Acceptance criteria

- Route selection is based on durable semantic obligation, not event source or
  synchronous waiting.
- Durable ownership is chosen before bounded execution technique.
- Top-level `subscriptions` and `tasks.subscriptions` are the only broad
  fact-to-work declaration surfaces.
- One App selects at most one broad fact-to-work route; exact stored Condition
  wakes may be additive.
- An exact task address bypasses broad inbox and task resolution and wakes only
  that task.
- Explicit `observations` selectors acknowledge reviewed no-op facts without
  creating work.
- Observers produce facts only.
- Inbox durability and task desired-state identity remain distinct.
- Deterministic helpers, skills, and workflows do not become durable owners.
- Workflow promotion has evidence-based signals, not a numeric gate.
- Workflow orchestration can be tested with fake agent responses even when a
  production step calls an LLM.

## Relationship to prior proposals

[Inbox Scope Reduction](inbox-scope-reduction.md) applies Rule 1 to event
admission and removes dual inbox/task ownership. [Canonical Agent App
Migration](../implementation/canonical-agent-app-migration.md) supplies the single App loader and
host boundary in which all three rules operate. The rejected service-composition
proposal does not change mechanism selection or add another work authority.
