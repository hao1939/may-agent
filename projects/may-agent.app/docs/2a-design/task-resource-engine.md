# Task Resource Engine

**Design status:** Accepted.
**Implementation status:** Core reconciliation, generation fencing, Conditions,
parent/child work, recovery, and bounded concurrency are implemented. Some
pressure/drain guarantees remain partial.

The task engine is an optional Host attachment for Apps that own desired state
across repeated bounded attempts. Read [agent-app.md](agent-app.md) first.

## When a task is appropriate

Use an App inbox item when the App owes one independently correlated result.
Attach a task only when an outcome needs stable desired-state identity for one
or more of these reasons:

- repeated reconciliation against current evidence;
- several inputs revise or wake the same outcome;
- an exact external Condition must be observed later;
- independently tracked decomposition or dependencies are needed; or
- the outcome is maintained over time.

Asynchrony, audit, importance, and restart survival alone do not require a
task. The inbox already persists a request across restart. Facts with no owned
result or desired-state change remain facts.

## Mental model

```text
App policy declares or revises TaskIntent
  -> Host persists canonical task state
  -> queue receives (appId, taskId)
  -> worker rereads and claims the current generation
  -> one owner or workflow performs one bounded attempt
  -> Host validates and atomically applies one result
  -> task converges, waits on exact evidence, or becomes visible attention
```

Observers publish facts. The Condition tracker may update exact Condition
state and wake its task. A periodic resync only redelivers known runnable task
IDs; it never invents desired state, polls external systems, or reads the task
tree as a queue.

The queue is an in-memory hint. The persisted task, trigger, Condition, and
attempt state are sufficient to recover it.

## Authority

| Surface | Role |
| --- | --- |
| `.state/tasks/state.json` | Sole mutable authority for tasks, Conditions, attempts, triggers, and receipts |
| `.state/tasks/tree.json` | Disposable human/UI projection |
| `tasks/seed.json` | Initial desired state for a new App |
| `project.json` | Authored project configuration, never rewritten by task operations |

`tree.json` may be regenerated and must never restore canonical state. Task
state retains the bounded detail needed for reconciliation and recovery;
long-term domain evidence belongs in projects, reports, knowledge, session
evidence, or other owned artifacts.

## Task identity and state

The stable execution key is `(appId, taskId)`. A task contains:

- `metadata.id`, `generation`, and `resourceVersion`;
- `spec` describing the outcome, mode, owner or workflow, inputs, outputs,
  dependencies, parent, priority, and acceptance; and
- `status` describing observed generation, phase, summary, evidence, current
  attempt, and linked Conditions.

`generation` advances only when execution-relevant desired state changes.
`resourceVersion` advances on any task-resource mutation. Results are admitted
only when the task ID, generation, resource version/claim, and attempt still
match. A stale result applies no mutation.

There is no manager-transfer lifecycle or ownership encoded in ID prefixes.
App policy validates which actions may revise a task; the generic engine uses
one admission path for all task IDs.

## Controller

An App with tasks has one logical controller and one deduplicating key queue.
An App without tasks has neither. The controller may:

- deduplicate and prioritize task keys;
- derive readiness from dependencies and exact Conditions;
- claim at most one current attempt per key;
- resolve the declared owner and optional workflow;
- validate and apply one result/action batch atomically;
- reject stale results; and
- repair bounded delivery and execution state after restart.

It must not interpret task prose, choose project strategy, infer external truth
from time, contain App-specific policy, or use `tree.json` as a scheduler.

Global and per-App capacity limits allow unrelated keys to run concurrently
while serializing each key. Durable excess work stays pending. A bounded urgent
FIFO lane favors exact wakes and continuations without starving older ordinary
work; elapsed time never promotes work into explicitly critical `P0`.

## Selecting the attempt handler

Owner resolution is:

```text
task.owner ?? nearest explicit ancestor owner ?? app.owner
```

An unresolved or unrunnable owner moves the task to `attention`. If the task
names a workflow, that exact workflow is the selected handler. An unavailable,
failed, timed-out, or invalid workflow does not silently fall back to the
owner.

A workflow may explicitly return `needs-owner` after exhausting its bounded,
safe moves. That creates at most one sequential owner attempt for the same
task. Cross-owner work is a typed App delegation/escalation, not
`needs-owner`.

## Result contract

The SDK schema and runtime admission use one result shape:

```ts
type HandlerResult =
  | {
      state: "converged" | "waiting";
      summary: string;
      evidence: string[];
      actions?: TaskAction[];
      conditions?: ConditionSpec[];
    }
  | {
      state: "needs-owner";
      summary: string;
      evidence: string[];
    };
```

Unknown fields are rejected. `needs-owner` is workflow-only. `waiting` requires
at least one open exact Condition or live direct child after actions are
applied. A thrown exception, timeout, unavailable runtime, invalid result,
rejected action batch, or failed verifier is a failed attempt—not a domain
result.

Creating follow-up work does not complete the current task. Required
decomposition creates direct children and returns `waiting`; independent later
work may be a successor only after the current outcome is actually accepted.

Actions and the result apply in one transaction. Races against a newer
generation or already-advanced target are treated as stale and retried from
current state, not converted into partial mutation or misleading attention.

## Acceptance

Mechanical validation proves that a result is safe to apply, not that its
domain claim is true. Every completed receipt records:

```ts
type AcceptanceBasis = {
  method: "deterministic" | "workflow-contract" | "owner-judgment";
  verifier?: string;
  evidence: string[];
};
```

A workflow verifier runs after result validation and before commit. It proves a
positive postcondition. Missing or unknown evidence is not success. When a
workflow can hand off with `needs-owner`, its hard verifier still applies to a
later owner claim of convergence.

## Conditions

A Condition names one exact external observation, for example:

```ts
{
  id: "credential-ready:xhs",
  type: "credential.state",
  subject: "credential:xhs",
  expected: { field: "state", equals: "ready" },
  reviewAfterMs: 300_000,
}
```

A watcher reads an external source and publishes a fact. It does not know task
storage or invoke an agent. The generic Condition tracker atomically updates
the Condition, stores the triggering event, and returns the affected task IDs
to enqueue.

`reviewAfterMs` is a bounded supervision checkpoint, never proof that the
Condition became true. Repeated unchanged reviews are capped; after the final
review the task remains on its exact event-driven wait rather than becoming a
polling loop. Provider observation time and monotonic source revision, when
available, prevent known older facts from replacing newer Condition state.

Human approval or action uses an explicit May/human request plus a Condition
on its exact disposition. The reply becomes evidence for the next attempt; it
does not itself prove the task outcome.

## Modes and phases

Phases are:

- `pending`: desired state needs another attempt;
- `running`: one current attempt owns the generation;
- `waiting`: exact Conditions or live direct children remain;
- `attention`: mechanics or result admission could not produce an applicable
  result and owner review is required; and
- `converged`: a live `maintain` task currently satisfies desired state.

An `achieve` task is finite. Acceptance writes a compact receipt, removes it
from the live graph, and wakes dependents. A `maintain` task remains live and
must be woken by a domain fact/watcher and, only where necessary, a declared
scheduled check. An observation arriving during an attempt keeps the same
maintain task pending for another bounded attempt.

## Parents and dependencies

Executable parents own aggregate outcomes. Structural groups provide display
containment only. Dependencies provide ordering. All use the same App
controller.

```text
parent returns waiting + child actions
  -> parent wait and children commit atomically
  -> children run within normal App capacity
  -> meaningful child transition stores a parent trigger
  -> parent rereads current children and receipts
```

The parent consumes no attempt slot while waiting. Only live direct children
form its decomposition frontier. Child completion does not automatically prove
parent completion; the parent judges aggregate acceptance. Missing parents,
self-parenting, and cycles are rejected.

## Outputs and workspaces

The Host resolves App, project, and workspace roots before an attempt and
admits declared outputs only inside allowed roots. A workflow may request a
task-generation Git worktree; its branch and lineage are attempt evidence, not
another scheduler or desired-state store. Output admission validates the task
contract but does not replace tool sandboxing or process isolation.

## Follow-up events

Task state and the event store are separate authorities. Task transitions
commit canonical state first; transition events are persisted observational
projections and may be lost if the process stops between those writes. Recovery
does not depend on replaying such an event: persisted task state, triggers,
parent wakes, dependencies, and Conditions make runnable work discoverable
again. Workflows still return the single result contract and do not publish
competing task-completion claims.

## Pause, reload, and recovery

Pause stops new task attempts. App input admission, schedules, observers, and
event routing continue, and task intent/wakes remain durable. Resume rereads
canonical state and queues runnable IDs.

Shutdown stops new claims, drains for a bound, and records unfinished attempts
as interrupted where possible. Restart repairs stale claims and requeues the
same task identities; it never resumes an in-memory workflow stack or fabricates
completion.

Hot reload publishes one validated App generation. Prior active attempts retain
their capacity claims until they end, while the replacement controller may use
remaining capacity. Generation and attempt fences prevent duplicate execution
or stale completion.

Recovery follows one ladder:

1. retry a known transient mechanical failure within its bound;
2. repair stale claims, leases, or queue hints;
3. requeue the same persisted task ID;
4. expose `attention` when domain judgment is required; and
5. delegate/escalate only when the next action crosses ownership.

Metrics and watchdogs may reveal a stuck task, but they never create a
replacement lifecycle or change desired state.

## Required invariants

Tests and audits must prove:

1. `state.json` is the only mutable task authority.
2. Queue entries contain IDs and stale readers claim current canonical state.
3. At most one current attempt exists per `(appId, taskId)`.
4. Condition update and trigger persistence are atomic.
5. Result/action admission is atomic and stale results apply nothing.
6. Completion has an explicit acceptance basis.
7. Parent waits and child creation commit together; meaningful child changes
   durably wake the same parent.
8. Pause/restart/pressure retain work without inventing another attempt.
9. Direct owner and workflow-nested sessions remain correlated to the current
   task generation and obsolete sessions cannot complete it.
10. Apps without desired-state reconciliation work without this engine.
