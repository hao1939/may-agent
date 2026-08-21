# Workflow Discovery And Execution

**Design status:** Accepted.
**Implementation status:** Implemented. Bounded TypeScript workflows use the
canonical scoped context as their public authoring contract; additional host
internals are not App capabilities and must not be consumed by new workflows.

## Purpose

A workflow is reusable bounded orchestration owned by one agent. It moves a
learned sequence, branching, bounded retry, and verification out of model
memory and into tested TypeScript.

```text
typed input -> bounded workflow -> agent/helper steps -> ExecutionResult
```

A workflow is not durable work ownership, a scheduler, an event handler, or a
suspended business process. The enclosing task owns the outcome. A workflow run
owns only one bounded execution attempt.

## Skill and workflow boundary

| Concern        | Skill                          | Workflow                        |
| -------------- | ------------------------------ | ------------------------------- |
| Primary source | `SKILL.md` instructions        | TypeScript module               |
| Controller     | Model judgment                 | Workflow code                   |
| Unit of use    | One model turn                 | One bounded execution run       |
| Sequencing     | Advisory                       | Enforced and testable           |
| Durable state  | None                           | None beyond attempt evidence    |
| Best fit       | Variable judgment-heavy method | Stable repeatable orchestration |

A workflow may ask an agent to apply a skill. The workflow controls sequence;
the skill guides judgment inside one step. Neither owns the enclosing App/task.

## Location and ownership

Canonical workflows live under the agent that owns the experience:

```text
projects/<id>.app/agents/<agent>/workflows/<name>.ts
agents/<agent>/workflows/<name>.ts
```

For an App task, ownership resolves from the task, nearest explicit ancestor,
then App owner. If that agent is App-local, its App-local workflow directory is
the complete scope; otherwise the standalone agent directory applies. The
runtime never merges catalogs from several owners or discovers an App-root
workflow registry.

Workflow names need only be unique within the resolved agent scope. Duplicate
effective names are invalid and visible in catalog diagnostics rather than
resolved by filesystem order.

## Module contract

```ts
import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";
import { verifyChange } from "./lib/verify-change.js";

type Input = {
  objective: string;
  maxAttempts: number;
};

export const name = "implement-and-verify";
export const description =
  "Implement one bounded change and prove it with deterministic checks.";

export async function execute(
  ctx: WorkflowContext<Input>,
): Promise<ExecutionResult> {
  let feedback = "";
  const limit = Math.max(1, Math.min(ctx.input.maxAttempts, 3));

  for (let attempt = 1; attempt <= limit; attempt += 1) {
    const implementation = await ctx.agents.call(
      "dev",
      [ctx.input.objective, feedback].filter(Boolean).join("\n\n"),
    );
    if (implementation.status !== "done") {
      return ctx.blocked("Implementation step did not finish safely", {
        executionId: implementation.id,
        status: implementation.status,
      });
    }

    const verification = await verifyChange(ctx.workspace?.root);
    if (verification.ok) {
      return ctx.done("Implemented and verified", {
        evidence: verification.evidence,
      });
    }
    feedback = `Attempt ${attempt} failed verification: ${verification.summary}`;
  }

  return ctx.blocked("Bounded repair loop exhausted", { feedback });
}
```

Rules:

- export explicit `name`, `description`, and `execute`;
- receive all invocation meaning through typed `ctx.input`;
- end every path with `ctx.done(...)` or `ctx.blocked(...)`;
- call agents with `ctx.agents.call` and nested workflows with
  `ctx.workflows.run`;
- keep deterministic mechanics in imported TypeScript helpers;
- use `ctx.read` only for exact bounded current facts;
- publish facts with `ctx.events.emit`, never as a work-dispatch shortcut; and
- keep tests beside the workflow or in the owning App's established test
  layout.

Do not reconstruct input from prompt text, global task files, event history,
the current working directory, or an unrestricted query.

## Scoped context

The canonical context contains:

- typed `input`;
- optional bounded `reconciliation` facts when a task owns the attempt;
- exact `read` projections for one App result, task, execution, or metric;
- bounded agent and nested-workflow execution;
- fact publication and domain metric recording;
- the allocated workspace/output paths; and
- logging plus one terminal result vocabulary.

It intentionally contains no raw database, event bus, task store, queue, lease,
scheduler, recovery handle, global path set, session manager, or arbitrary
command surface.

### Workflow or host-private maintenance handler

The absence of raw SQL and host paths is an authoring boundary, not a missing
workflow feature. If a timed job must inspect runtime-owned ledgers, repair
host mechanics, or produce an operational report from global runtime state, it
is a host-private maintenance handler rather than an App workflow.

That handler may use an explicitly supplied host query/path/delivery adapter,
record its mechanical output, and publish a fact such as an owner request. It
cannot become a second App inbox or task controller, and it cannot duplicate a
canonical App schedule/subscription for the same obligation. Any judgment or
durable domain continuation still enters the App through a declared input,
subscription, task trigger, or exact target.

Placement beside an App-local operations agent does not make a host handler a
public App capability. Host-handler modules use a local structural contract and
are checked against the paired Runtime separately from workflow authoring.

### Task reconciliation input

For task-owned execution, `ctx.reconciliation` supplies:

- App/task identity and current generation/resource version;
- resolved owner, mode, outcome, and acceptance;
- typed workflow input;
- bounded live and completed child views; and
- a capped snapshot of other live App tasks when App-wide frontier health must
  be reviewed; and
- the exact event that triggered this pass, when present.

The snapshot excludes the current task, carries a `truncated` bit, and does not
change parent/child ownership semantics. These facts are enough to reconcile
current desired work without parsing a prompt packet or reading global task
persistence. A workflow returns a typed output for the task boundary to
validate and admit. It never edits task state itself.

## Invocation

Workflow execution is explicit from one bounded owner:

```text
task reconciler -> resolved owner workflow
App owner       -> bounded workflow capability
workflow        -> ctx.workflows.run(name, input)
model tool      -> explicit workflow invocation
```

An App schedule, fact subscription, observer, or metric cannot directly launch
a workflow. It first creates the appropriate App request or persisted task
intent; that durable owner then decides whether a workflow is required.

Descriptions aid discovery but never trigger code by fuzzy matching.

## Synchronous bounded execution

Synchronous describes the control contract, not the absence of JavaScript
`await`: each declared step finishes before dependent code continues, and the
caller receives one terminal result from the run.

The host applies one finite deadline to the whole workflow attempt, including
code between agent calls. A workflow that stalls before or after a model step
cannot hold App/task capacity forever. Deadline expiry is execution failure,
not domain judgment.

Retries inside a workflow must be bounded and must use changed evidence. A
workflow cannot recursively re-enter itself with the same input and state. Each
iteration must implement/verify a change, establish a durable wait, return a
result, or fail honestly.

Good in-run waits are bounded operations such as:

- an awaited agent call with host timeout;
- an imported deterministic helper or provider request;
- a nested workflow returning `done` or `blocked`; or
- a bounded retry with explicit limit and terminal condition.

## Durable waits

Do not keep a workflow open across human replies, approval, long timers,
callbacks, runtime restart, unavailable providers, or other unbounded waits.

For task work:

```text
workflow pass -> return typed waiting result + exact Conditions -> run ends
later fact    -> exact task wake -> new reconciliation pass
```

For a cross-App dependency:

```text
task pass -> return typed child dependency -> run ends
child result -> parent task wake -> new reconciliation pass
```

The next pass receives current durable state through its typed request or
reconciliation context. It never depends on workflow-local variables, an open
session, module memory, or source-session resume.

`ctx.done` means this bounded workflow completed its own contract. It does not
mean the enclosing App request, task, or project completed. `ctx.blocked` means
this workflow cannot safely produce its contract; it does not create a durable
wait, escalation, owner handoff, or new request automatically.

## Result admission

All agent and workflow calls use:

```ts
type ExecutionResult<T = unknown> = {
  id: string;
  kind: "agent" | "workflow";
  status: "done" | "blocked" | "error" | "interrupted";
  summary: string;
  output?: T;
  evidence?: unknown;
};
```

When later workflow code requires structured agent output, the workflow owns a
TypeBox or equivalent schema and validates `result.output` before use. A prose
response or invalid payload cannot become trusted domain data. At most one
bounded correction may occur inside the agent execution contract; validation
never starts an unbounded model retry loop.

The App/task boundary separately validates the workflow's terminal output,
generation, allowed actions, Conditions, and evidence. An execution status of
`done` is still only a claim until admitted.

For task-owned work:

- continue locally while bounded in-scope repair remains;
- return exact Conditions only after establishing the corresponding external
  dependency;
- use `needs-owner` only for exceptional same-App judgment the learned workflow
  cannot safely resolve;
- create cross-App/human escalation only through an explicit App/task
  dependency; and
- use `blocked` for inability to produce a safe structured execution result,
  not as an ordinary domain branch.

## Facts and side effects

`ctx.events.emit` publishes observed or produced facts. In a resource-backed
task attempt, every event requires a stable `localKey`. The Host verifies the
attempt fence, deduplicates that key within the task generation, persists the
event and exact target wake, and only then exposes it to subscribers. This
commit is independent of the workflow's later final result. The workflow cannot
assume publication means another owner accepted work. Any actionable consumer
must be declared by the destination App as an input subscription, exact task
target, or matching Condition.

The compatibility `ctx.emit` and `ctx.dispatchEvent` forms are rejected for a
resource-backed task because they cannot carry the fenced local key. Use
`ctx.events.emit`. To request a result from another App, return a typed
dependency instead of emitting `app.input.requested`; the App request row is
the single durable correlation authority.

Where a domain mutation and its resulting fact must be atomic, use an explicit
domain adapter/outbox capability owned by the Host. Do not emulate
atomicity by writing runtime SQL or emitting before the mutation is durable.

`ctx.metrics.record` records one domain measurement. Metrics and emitted facts
must not become workflow-local retry schedulers.

## Workspace convention

The host allocates the workflow workspace according to the App/task policy and
provides only:

```ts
ctx.workspace?.root;
ctx.workspace?.output;
```

All file and command work stays beneath that allocation. Workflows do not
derive repository, App, agent, or persistent-state roots from process cwd.

For isolated Git work, the host owns worktree creation, base revision, branch
lineage, cleanup, and recovery. A workflow returns verified evidence and clean
result; it does not create a parallel workspace registry or select random
branches. Retries for one task generation preserve the recorded lineage.

Shared ledgers, observation state, and maintenance migrations do not belong in
task worktrees. Genuine offline repair belongs in an explicit maintenance CLI.

## Discovery, reload, and provenance

Discovery enumerates the resolved agent's workflow entries, imports and
validates exports, rejects duplicate effective names, and produces an immutable
catalog snapshot for each dispatch generation. Missing roots are empty;
invalid modules are visible but not invocable.

A run records at least:

- workflow name and owning agent/App scope;
- entry path and source revision/hash;
- input/reconciliation identity without leaking secrets;
- parent execution and causal trigger;
- child execution IDs;
- terminal status, summary, output/evidence references; and
- allocated workspace lineage where applicable.

Active runs keep their prepared source generation. A reload affects subsequent
dispatch only. A complete executable fingerprint should cover the entrypoint,
repository-local imported source graph, and dependency lock revision; an entry
hash alone is useful evidence but not a full reproducibility claim.

Workflow-run storage and SQL projections are host-private. App code consumes
only bounded `ExecutionView`/result references.

Expected durable waits always start a new workflow run later. Recovery of an
interrupted run is mechanical attempt recovery only; it never becomes a hidden
business-process continuation mechanism.

## Promotion heuristic

Promote a learned practice to a workflow when evidence shows:

- ordering or omission materially affects correctness;
- inputs, outputs, and terminal conditions can be explicit;
- deterministic checks and bounded repair improve reliability;
- the process is stable enough for code and tests; and
- it still fits one bounded execution attempt.

Three successful runs may be useful evidence of stability, but they are not a
hard threshold. A known safety-critical protocol may deserve a typed, tested
workflow before its first production run. Frequent execution alone is not a
reason to promote an unstable or judgment-dominated sequence.

Workflows may call agents. Their workflow-owned schemas, branching, limits,
gates, verification, and result admission must be testable with fake agent
responses rather than requiring a live model in unit tests.

Keep it as a skill when the right sequence is highly contextual, judgment
dominates, or the process is still being learned. Split it across App/task
reconciliation when it requires durable waits.

## Integrity checklist

- Every workflow belongs to one agent and one immutable dispatch snapshot.
- Every invocation has typed input and one bounded terminal result.
- The enclosing App request/task, never the workflow run, owns durable work.
- Schedules, observers, facts, and metrics cannot launch workflows directly.
- Durable waits end the run and resume through persisted App/task state.
- Agent outputs and workflow outputs are validated before domain admission.
- Workflows use scoped reads and workspace paths only.
- No workflow imports raw SQL, task storage, global paths, scheduler, queue,
  lease, delivery, or recovery mechanics.
- Runtime-ledger observation or repair that needs those capabilities is
  explicitly classified as a host-private maintenance handler, never disguised
  as a workflow.
- Result `done` never implies enclosing task/project completion without owner
  admission and evidence.
