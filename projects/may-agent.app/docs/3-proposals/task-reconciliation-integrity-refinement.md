# Proposal: Task Reconciliation Integrity Refinement

**Design status:** Revised after review; recommended for acceptance.
**Implementation status:** In progress. Pure read-model projection, targeted
routing, parent non-scheduling, the three public handler states, and canonical
seed shapes are implemented. Shared admission, acceptance provenance, runnable
owner admission, path boundaries, and final live-state cutover remain.

## Requested Decision

Approve, revise, or reject these refinements to the existing Kubernetes-style
task reconciliation model:

1. the generic reconciler contains no app policy and writes only canonical task
   state;
2. the SDK owns one executable handler-result contract used by workflows,
   agents, tests, and runtime admission;
3. convergence records how acceptance was established instead of treating a
   handler claim as mechanically verified;
4. every task owner resolves to a runnable agent; human and external waits are
   Conditions plus notification or escalation;
5. task specs, workspace paths, projections, and compatibility state each have
   one clear authority.

This proposal tightens the integrity boundary. It does not replace the current
task engine, add another scheduler, or make task reconciliation mandatory for
an Agent App.

### Review disposition

- Accept Decisions 1, 4, 6, and 7.
- Accept Decision 2 without a public `failed` state and with convention
  defaults shared by model and authored actions.
- Accept Decision 3 with `workflow-contract` acceptance; do not require an
  implicit owner turn after a workflow converges.
- Accept Decision 5 with an execution fingerprint; organization-only changes
  advance resource version without invalidating useful work.

## Why This Refinement Is Needed

The current model is directionally correct and already provides stable task
identity, `spec`/`status`, attempts, Conditions, stale-result rejection, owner
fallback, and compact completion receipts. Review of
`scout-knowledge-lib.app` exposed places where implementation can still report
success while violating that model:

- an app-local planner test accepts a `create-task` result that the runtime
  rejects because its copied schema omitted required fields;
- a task owned by `human` is repeatedly executed as though `human` were a
  registered agent instead of waiting for an external observation;
- a workflow can claim `converged` and receive a completion receipt without
  acceptance provenance, and the runtime cannot yet invoke an optional
  deterministic workflow verifier;
- relative output instructions allowed files to be written into a recursively
  nested project directory;
- legacy tasks with removed workflow bindings remain live in `attention`;
- a proposed generic reconciler change derives app-specific focus policy from
  owner names and goal prose, then writes several competing readout surfaces.

These are not reasons to abandon the Kubernetes pattern. They show that the
admission, acceptance, and projection boundaries need to become executable
rules rather than documentation conventions.

## Refined Mental Model

```text
app resolver
  -> declares desired task spec

event or resync
  -> records a trigger observation
  -> enqueues the stable task identity

generic reconciler
  -> compares normalized spec with status
  -> claims one generation
  -> invokes the bound workflow or resolved owner
  -> admits one shared structured result
  -> establishes acceptance
  -> atomically applies task commands and status

read model
  -> derives human views from canonical state
  -> never writes strategy back into task intent or project configuration
```

The compact rule remains:

> Apps organize work. Agents decide. Workflows repeat learned processes. The
> reconciler enforces mechanics. Conditions represent external facts. Read
> models explain canonical state.

## Decision 1: Keep The Generic Reconciler Generic

The generic reconciler may understand only shared mechanics:

- task metadata, spec, status, attempts, receipts, and Conditions;
- ownership resolution and explicit workflow lookup;
- generation and resource-version checks;
- bounded retries, recovery, and result admission;
- atomic task/Condition commands; and
- generic projections directly implied by canonical state.

It must not:

- recognize a particular owner such as `app-ops` or `scout`;
- parse outcome or goal prose to infer special behavior;
- decide an app's current focus or strategy;
- write `project.json` or another app-owned configuration artifact; or
- maintain several writable copies of the same focus/readout fact.

Human-facing focus, branch health, and frontier counts are read models. The
preferred implementation computes them on read from `.state/tasks/state.json`.
If caching later becomes necessary, one generic projector may own one
disposable cache. The task reconciler remains its source, not its writer.

### Authority rule

```text
.state/tasks/state.json  -> sole mutable task authority
.state/tasks/tree.json   -> generated disposable projection
project.json             -> authored app/project configuration
HTTP/UI/query readouts   -> derived views
```

No projection is copied back into canonical task state, and no generic task
operation rewrites authored project configuration.

## Decision 2: Use One Executable Handler Contract

The SDK type alone is insufficient when workflows copy a separate model-output
schema. The SDK must expose one executable contract module from which all of
these are derived or directly reused:

- TypeScript types;
- model output schema;
- runtime validation and normalization;
- workflow authoring helpers; and
- test fixtures.

The shared contract continues to support:

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

`needs-owner` remains valid only for a workflow. An already resolved owner must
choose `converged` or `waiting`. A thrown exception, unavailable runtime,
invalid envelope, rejected command, or exhausted timeout is a failed attempt;
`failed` is not reintroduced as a fourth handler decision.

The contract applies the same conventions for authored and generated task
actions:

- `parentId` defaults to the app's root group;
- `mode` defaults to `achieve`;
- `priority` defaults to `P2`;
- `outputs` defaults to an empty list; and
- the desired result is named `outcome`, not the legacy action field `goal`.

Standing work must still say `mode: "maintain"`; the common finite case does
not need repeated configuration. `input` and `dependsOn` remain optional
shared fields and may not disappear from an app-local schema. An update action
must also be able to set or clear an explicit owner or workflow binding so a
bad live binding can be repaired through the supported contract.

An app test is not sufficient merely because its workflow returns an object.
At least one contract test must send representative workflow output through
the same admission function used by production.

## Decision 3: Make Acceptance Honest

`converged` is a handler claim. Mechanical admission always checks the current
generation, result shape, action scope, exact Conditions, evidence requirements,
output boundaries, and atomic command validity. Admission proves that the
result is safe to apply; it does not prove the domain claim.

After admission, a receipt records one of three acceptance methods:

1. **`deterministic`** — the bound workflow exposes a pure or bounded `verify`
   function, and the runtime records its successful postcondition evidence.
2. **`workflow-contract`** — the owner delegated this task to reusable
   experience. The workflow's admitted result and evidence satisfy its
   contract, including any verification performed inside that workflow.
3. **`owner-judgment`** — the resolved owner handled the task directly or after
   an explicit `needs-owner` handoff and accepted the semantic result.

For a workflow-backed task:

```text
workflow claims converged
  -> runtime admission
  -> workflow verify exists: run it and record deterministic acceptance
  -> otherwise record workflow-contract acceptance
```

The runtime does not automatically invoke the owner after a workflow claims
convergence. Workflow binding is already owner delegation; requiring another
owner turn would erase the value of reusable experience. A workflow requests
owner judgment explicitly with `needs-owner`. Apps may put independent review
inside a high-risk workflow, but it is domain policy rather than a generic
reconciliation layer.

The optional verifier uses one SDK contract:

```ts
type VerificationResult = {
  accepted: boolean;
  summary: string;
  evidence: string[];
};

verify(context: ReadonlyVerificationContext, result: HandlerResult):
  Promise<VerificationResult>;
```

It runs after mechanical admission and before the task-command/receipt
transaction. Its context exposes resolved paths and read-only observations,
not task mutation commands. `accepted: false` fails the attempt with its
summary and evidence.

Completion receipts should record the acceptance method and evidence:

```ts
verification: {
  method: "deterministic" | "workflow-contract" | "owner-judgment";
  verifier?: string;
  evidence: string[];
}
```

A failed verifier must not produce a completion receipt or `converged` status.
It fails the attempt with verifier evidence; the existing bounded recovery
policy decides whether to retry or move the task to `attention`.

## Decision 4: Owners Are Runnable Agents

Every resolved task owner must identify an agent that the current app/runtime
can execute. Owner validation happens before an attempt is claimed.

`human` is not a special agent name or a waiting state. When progress requires
a person or an external system:

```text
task returns waiting
  -> exact Condition identifies the observable fact
  -> infrastructure notifies or escalates outside the task execution path
  -> watcher or human action emits the semantic observation
  -> Condition becomes true
  -> original task reconciles again
```

Example:

```ts
{
  id: "credential-ready:xhs",
  type: "credential.ready",
  subject: "credential:xhs",
  expected: { field: "state", equals: "ready" }
}
```

The task remains owned by its accountable agent. Notification delivery may
target a human, but notification ownership and task ownership are not the same
concept.

## Decision 5: Separate Execution Generation From Organization

`resourceVersion` changes for every canonical mutation. `generation` changes
only when normalized desired state changes in a way that can invalidate a
handler result. The execution fingerprint contains:

- outcome and acceptance;
- mode;
- the resolved effective owner and workflow binding;
- stable input and declared outputs; and
- dependencies.

Containment (`parentId`), presentation (`category`), and triage (`priority`)
remain desired organization but do not by themselves invalidate an active
attempt. They advance `resourceVersion`, not `generation`. If moving a task
changes its inherited effective owner, the effective-owner change does advance
generation. Priority remains a human/read-model hint; the task graph does not
become a scheduler.

Defaults and effective ownership are normalized before fingerprinting. Trigger
observations, event IDs, timestamps, attempt summaries, current Condition
observations, and other status never enter the fingerprint. They remain in
trigger/status resources.

## Decision 6: Resolve Workspace Paths Once

Infrastructure resolves absolute app, domain, and execution paths once before
a workflow or agent starts:

```text
appDir       = app code and configuration
projectDir   = the app's declared domain workspace
workspaceDir = the current execution workspace, when one exists
```

Prompts and workflow helpers use these resolved paths rather than deriving one
path from another or assuming the process working directory. Declared output
paths are resolved once and checked against the allowed app/domain roots. A
result that claims an output outside those roots is rejected unless the
external root was explicitly supplied as a capability.

This is primarily an execution-context rule. It does not require the task
engine to understand domain filenames or inspect prose.

## Decision 7: Finish Compatibility Migration

Once every deployed app has canonical `.state/tasks/state.json`:

- `.state/tasks/tree.json` is never accepted as bootstrap authority;
- seed files initialize a new app only and contain standing desired state, not
  completed migrations or incident history;
- removed workflow bindings are migrated or closed through one reviewed
  operation; and
- compatibility readers and legacy authoring shapes are deleted rather than
  retained indefinitely.

Live-state cleanup is app-owned migration work. The generic reconciler must not
guess that an unfamiliar task is obsolete merely because its workflow is
missing.

## Scout Validation During Cutover

`scout-knowledge-lib.app` is evidence for this proposal and is the clearest
small validation case during the already planned all-app cutover:

1. replace its copied planner schema with the shared result contract;
2. add a production-admission round-trip test;
3. replace the human-owned XHS cookie task with a credential Condition;
4. use resolved absolute paths in Scout workflows and add an output-boundary
   assertion;
5. review stale `attention` tasks once, preserving unfinished work and closing
   absorbed work; and
6. reduce its seed to standing desired state and correct its task/readout docs.

The nested project artifacts must be reviewed before removal. This proposal
does not authorize deleting live project data.

## Implementation Sequence

1. **Done:** keep app policy out of the reconciler and derive focus/frontier
   readouts without writes.
2. Introduce the SDK contract schema, normalizer, and authoring helpers; make
   runtime, owner output, workflows, and app tests consume them.
3. Apply convention defaults, replace action `goal` with `outcome`, and support
   explicit owner/workflow binding repair.
4. Implement optional verifier invocation and receipt acceptance provenance.
5. Validate runnable ownership before claiming an attempt and migrate the Scout
   credential wait to an exact Condition.
6. Fingerprint only normalized execution intent, including the effective
   owner, while keeping organization changes on `resourceVersion`.
7. Provide resolved absolute paths and generic output-boundary admission.
8. Migrate all paused app live state through reviewed one-off operations,
   using Scout as the focused validation case.
9. Remove `tree.json` bootstrap, legacy action shapes, and stale documentation;
   then deploy, restart-validate, and resume the apps.

Each step remains independently testable and revertible. Live-state migration
comes after code admission and recovery tests, not before.

## Required Tests

The proposal is complete only when tests prove:

1. app-local workflow output is accepted or rejected by the exact production
   contract;
2. omitted `create-task` convention fields normalize to root parent, `achieve`,
   `P2`, and empty outputs before task mutation;
3. `input` and `dependsOn` survive schema validation and storage;
4. a deterministic verifier failure prevents convergence and receipt creation;
5. a receipt records deterministic, workflow-contract, or owner-judgment
   acceptance evidence without an implicit second owner turn;
6. an unresolved owner cannot create a running attempt;
7. an external credential wait creates no human-agent session and wakes only
   from its exact Condition;
8. parent/category/priority-only changes advance resource version without
   interrupting the current generation, while an effective-owner change does;
9. trigger timestamps do not increment generation;
10. read-model construction does not write project configuration or task
    intent;
11. relative execution working directories cannot redirect declared outputs
    into a nested project tree; and
12. missing canonical state does not restore authority from `tree.json` after
    compatibility removal.

## Non-Goals

- A new scheduler, queue, workflow engine, or task kind.
- Automatically interpreting task prose.
- Making every semantic acceptance deterministic.
- Treating humans as durable worker agents.
- Automatically deleting stale tasks or misplaced project files.
- Moving app strategy into shared infrastructure.
- Requiring task reconciliation for direct or Gym agent execution.

## Review Checklist

- Is the reconciler boundary mechanical enough to remain reusable across apps?
- Is owner judgment distinguished honestly from deterministic verification?
- Is the human-wait model simple enough: Condition plus notification?
- Does one shared contract eliminate app/runtime schema drift?
- Can Scout migrate without deleting useful evidence or inventing compatibility
  layers?
- Are any proposed checks actually domain policy that should remain in Scout?
