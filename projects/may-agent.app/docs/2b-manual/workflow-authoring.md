# How To Write An App Workflow

This manual describes the canonical App workflow surface. See
[Workflows](../2a-design/workflows.md), [SDK](../2a-design/sdk.md), and
[App](../2a-design/agent-app.md) for the governing contracts.

The [enforcement table](../2a-design/workflows.md#enforcement-infrastructure-and-guidance)
identifies what shared code enforces, what it only supports, and known gaps.
The best practices below guide author decisions; uncertain choices stay advisory
until experience justifies a stronger contract. This guide targets the shared
handoff candidate recorded in the [Task context proposal](../proposals/task-context-discovery-20260917.md).

## Choose A Skill, Module, Or Workflow

- Use a skill when an agent should interpret reusable judgment for one turn.
- Use a normal TypeScript module for pure calculations and shared mechanics.
- Use a workflow for bounded, repeatable sequencing that must return one typed
  terminal result to its caller.
- Use an App request or task when work must survive beyond the current run.

A workflow is not a queue, daemon, owner inbox, or durable wait. Its TypeScript
module controls the bounded run; its description is discovery metadata.

Prefer focused parts whose inputs and retained results can be evaluated
independently. Compose them through ordinary calls and the existing Task handoff
contract. Keep identity, outcome, evidence references and limitations explicit;
do not copy a large upstream report into every result. Test each part against
fixed inputs and test the handoff separately. Reuse unchanged upstream evidence
after a downstream failure; invalidate dependent evidence when its inputs change.
This is authoring guidance, not a required stage registry or one Task per step.

## Location And Shape

Put a workflow under the agent that owns and operates it:

```text
projects/<id>.app/agents/<name>/workflows/<workflow>.ts
agents/<name>/workflows/<workflow>.ts  # standalone/system agent only
```

Use a flat `.ts` module exporting `name`, a nonempty `description`, and
`execute(ctx)`. Start from the [checked review example](../examples/review-change.ts).
It validates its input, requests structured review output, retains incomplete
work, and returns a completed review even when the verdict asks for changes.
Its `reviewer` is an example team capability, not a universal role or an installed
agent guaranteed by the Host. Its description states the promised result and scope.

Procedure input types belong to that module. Validate their shape and limits
before use; a TypeScript generic does not validate incoming JSON at runtime.
Adding a recipe does not require a new public App input variant.

Workflows are bounded and ordered. They may use `await`, but every awaited
agent, nested workflow, read, metric write, or fact publication must finish in
the current run.

## Workflow Context

The stable capabilities are:

| Capability                               | Purpose                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| `ctx.input`                              | App-owned typed workflow input                                                 |
| `ctx.signal`                             | Shared cancellation/deadline signal; pass it to cooperative I/O                  |
| `ctx.reconciliation`                     | Exact task generation, events, and bounded child/frontier facts when a task owns the run |
| `ctx.read.appResult(id)`                 | Read one completed App result                                                  |
| `ctx.read.tasks.get(id)`                 | Read one bounded current-App task resource                                     |
| `ctx.read.tasks.list(options)`           | List one bounded page of current-App task summaries                            |
| `ctx.read.execution(id)`                 | Read one bounded execution projection                                          |
| `ctx.read.metric(id)`                    | Read one metric projection                                                     |
| `ctx.agents.call(agent, task, options?)` | Run and await one bounded agent execution                                      |
| `ctx.workflows.run(name, input)`         | Run and await one nested workflow                                              |
| `ctx.events.emit(event)`                 | Publish an immediate durable fact from the current bounded attempt             |
| `ctx.events.read(type, localKey)`         | Inspect a retained publication in this Task generation                          |
| `ctx.events.onEvent(listener)`           | Observe live Task input; returns an unsubscribe function, not an acknowledgment |
| `ctx.metrics.record(...)`                | Record a domain metric definition/sample                                       |
| `ctx.workspace`                          | App/task-scoped source and output paths when granted                           |
| `ctx.log`                                | Structured diagnostic logging                                                  |
| `ctx.done(summary, output?)`             | Return one successful bounded result                                           |
| `ctx.blocked(reason, evidence?)`         | Return one local terminal blocker                                              |

The context intentionally excludes raw SQL, global queries, task storage,
queues, leases, scheduler handles, session steering, human delivery, and
recovery APIs.

## Terminal Results

Normal workflow branches return one `ExecutionResult`, usually through
`ctx.done(...)` or `ctx.blocked(...)`. The common vocabulary also carries
`error` and `interrupted` with available output/facts. Setup, cancellation or
infrastructure failures can throw; do not catch them merely to claim success or
fabricate an execution identity. A system failure may carry its result on
`error.execution`; retain it when handling that failure.

`done` means this bounded workflow completed. It does not by itself complete an
App request or task. The calling App/task boundary validates and admits the
output.

Use `id`, `kind`, `status`, `summary`, `output` and `facts` consistently for agent
and workflow contributions. The candidate maps explicit partial agent work to
`blocked` and preserves the original finish facts. Inspect evidence as well as
status: normalization cannot establish semantic completeness. A completed review
can be `done` while the reviewed implementation still needs changes. An unfinished
review is incomplete even if it produced useful findings. A no-op needs a completed
observation and a reason no change is warranted; an exhausted allowance is not one.

Keep useful output/facts from every terminal status. For a compact child result,
`ctx.blocked(reason, { review })` preserves its identity and findings. Store large
bodies through existing artifact support and return exact readable references;
the Host's retained inspection copy is bounded, not a complete archive.

`blocked` means this run cannot continue locally. It does not delegate,
escalate, start an agent session, notify a human, or keep the workflow open.
The owning App request or task decides the durable next state.

## Task-Bound Workflows

When a task owns the run, `ctx.reconciliation` supplies:

- App/task identity and fenced generation;
- outcome, acceptance, selected agent, and typed input;
- ordered unobserved Task events; and
- bounded live/completed direct children.

It does not expose a global Task hierarchy or mutation handles. Distinguish an
agent-selected helper workflow from a workflow bound as the Task executor. The
helper returns its contribution to the agent. The Task executor returns the
reconciliation output expected by the App; its caller admits that output.

Use the [checked Task result examples](../examples/app.ts) for exact Condition
and dependency shapes, returned with `ctx.done(result.summary, result)` by a
Task workflow. See [Task authoring](handler-authoring.md) for the owning contract.
No live children is not sufficient evidence that acceptance is met. Retain exact
`facts`, and describe a real wait or the supported outcome.

Return execution status, waits and dependencies as typed output. When supplied
by the Task caller, `ctx.reviseTask` updates creator-owned requirements through
the Host's authority checks. It does not update execution status. Do not edit
Task-state files, write projections, acquire Task locks, or emit
assignment/completion events.

For a resource-backed task, publish facts only with
`ctx.events.emit({ type, localKey, data })`. The older `ctx.emit` and
`ctx.dispatchEvent` forms are rejected because they bypass the attempt fence.
Return cross-App result work as a typed dependency; do not emit
`app.input.requested` directly.

Use `needs-agent` only when the same App needs exceptional judgment from its
selected agent. Do not clear an explicit workflow merely to let an agent perform
workflow-owned effects.

### Cross-App outcome reviews

A reviewing App uses the same Task mechanism as any other App. Code may use
bounded public catalog and Task reads to bind an external `(appId, taskId)` and
collect mechanical evidence; an agent judges responsibility, recovery,
verification, and delivery. Caller hints and session identity do not establish
ownership. Missing or conflicting evidence is an inconclusive review result,
not a target failure and not healthy coverage.

Published review artifacts belong in a configured durable App output beneath
`.state`, not a source checkout or disposable Task worktree. Immutable reports
and facts sidecars are evidence. A bounded list/read workflow may expose them
to May through ordinary App actions without launching a new review. Receipt or
acknowledgment does not mean a finding was fixed; verified resolution requires
later evidence from the responsible App's accepted Task result or output.

## Durable Wait Boundary

Never keep a workflow alive while waiting for a human, approval, timer,
provider callback, another App, process restart, or long-running external fact.

Use the owning durable authority:

```text
cross-App outcome -> task returns typed dependency -> exact child App task result
external fact     -> task returns waiting -> exact Condition/external fact
```

The Task boundary admits and persists the returned dependency before waiting.
A later result or fact wakes that exact authority. Do not reconstruct the
wait from an event pair, owner label, message, session, or prompt.

Use a namespaced Condition event type and identify its real producer and ingress.
The wait-recovery candidate rejects unnamespaced types in the shared finish
schema and runtime admission. A namespaced name alone does not install a producer:
the ordinary public publish interface accepts registered events, while an
explicit operator-fact route may admit custom namespaced facts. A Condition's
`requestedAction` never sends a request to its owner. Prefer the returned wait
from an existing capability when it supplies one.

Omit unchanged Conditions to retain their identities. Changing or replacing a
wait returns the affected unanswered inputs for reconsideration on the next
eligible attempt; it does not prove their outcomes. Finish with the normal
result, without an action to unblock the executing Task itself.

## Agent And Nested Workflow Calls

Use `ctx.agents.call(...)` when another agent can return a bounded result during
this run:

```ts
const implementation = await ctx.agents.call("dev", implementPrompt);
if (implementation.status !== "done") {
  return ctx.blocked("Implementation failed", { implementation });
}

const review = await ctx.agents.call("qa", reviewPrompt, {
  schema: ReviewResultSchema,
});
if (review.status !== "done" || !review.output || review.output.verdict !== "pass") {
  return ctx.blocked("Review failed", { review });
}
```

This example assumes a passing review is required for the implementation
procedure. That is an App requirement, not a rule that every completed review
must be positive. Names, prompts and schema are owned by this example's App.

Use `ctx.workflows.run(...)` for another bounded recipe:

```ts
const result = await ctx.workflows.run("verify-change", {
  changeId: ctx.input.changeId,
});
if (result.status !== "done") {
  return ctx.blocked("Verification did not complete", { result });
}
```

Background forks and direct agent messages cannot satisfy a workflow
dependency. If work must outlive this run or cross an App boundary, use the App
request/task model instead.

All four call directions share the same contribution rules. Give a helper its
specific outcome, constraints and relevant references. The Host supplies caller
identity and shared Task context; do not copy the whole transcript or rewrite
`TASK.md` for each specialist. Read the brief as a snapshot and follow its links
for current state or omitted information. The caller judges the contribution;
the Task's owner judges the whole outcome.

## Best Practices And Learning

Use these as a starting point, adjusting them to the assignment. They introduce
no new Host rejection, required helper, fixed review graph or universal retry
count. Explicit user constraints and established App acceptance still apply.

| Decision | Starting guidance | What to learn from actual use |
| --- | --- | --- |
| Sequence | Inspect context and prior evidence; do missing work; check it; return evidence. Use fewer steps when sufficient. | Which omissions actually caused incorrect or incomplete results? |
| Team | Call a specialist when its contribution adds useful judgment or capacity. Keep narrow assignments clear. | Did it find something useful, or repeat the caller's work? |
| Updates | Reassess relevant input between meaningful operations, before an affected write, and before relying on affected evidence. | Where did a correction arrive too late or get misunderstood? |
| Progress | Report a useful finding, blocker or changed expectation through existing facts. Avoid a message for every internal step. | Could the caller understand progress without repeated status requests? |
| Repair | Feed the failed check and partial work into a bounded, plausible next attempt. Stop or return control when the method no longer fits. | Was another attempt useful, or did it repeat the same failure? |
| Evidence | Keep compact findings and exact references; use the supplied workspace and existing artifact helpers. | Could another agent find, read and assess the result without repeating the investigation? |
| Reuse | Check prior evidence against the current requirement and actual target state. | Which reused facts became stale, and which rechecks were unnecessary? |

For long work, `await` suspends that dependency, while the Host continues admitting
input. Agents receive live hints; a workflow may use `ctx.events.onEvent` to mark
that new information needs inspection at its next useful decision point. Keep
listeners lightweight, unsubscribe when finished, and keep decisions/effects in
normal execution. A listener is optional. It should not launch a competing
executor, accept input, or invent a private durable inbox. Choose checkpoint
placement through experience; a callback per step is not required.

The current reconciliation context and Task brief are attempt-start snapshots.
Live delivery does not prove incorporation, and explicit incorporation bookkeeping
is still unfinished. Use current reads and retained input; let a subsequent
same-Task attempt reconsider pending input where needed. Do not promise instant
steering, complete historical pagination, or cancellation of arbitrary JavaScript.

When uncertainty remains, keep the recommendation as guidance and record the
observed limitation. Reuse the Task's results and execution references to capture
the assignment, method, outcome, relevant correction/failure and useful or wasted
work. No extra reporting schema or evaluation service is needed. A few successful
runs can inform a decision; they are not a universal promotion threshold.

Promote a practice only when its benefit and scope are clear:

- Stable domain sequence or acceptance check: put it in the owning workflow/App
  with a meaningful failure-case check. If every method must satisfy it, enforce
  it at the App's common acceptance boundary.
- Repeated missing mechanical capability: first improve an existing SDK/tool/read
  or ordinary helper. Add Host support only for a shared execution guarantee.
- Context-dependent judgment: retain guidance, examples and agent discretion.

For example, lost returned evidence justified shared result preservation. The best
number of reviewers or interval between updates remains uncertain. Hardcoding
either would constrain agents without the same evidence of benefit. A proposed
checkpoint helper, richer input discovery or reusable evidence helper should first
show which concrete failure existing capabilities cannot reasonably prevent.

## Facts And Metrics

Publish only semantic facts whose route or observation status is declared:

```ts
await ctx.events.emit({
  type: "sample.change.verified",
  localKey: `change-verified:${ctx.input.changeId}`,
  data: { changeId: ctx.input.changeId },
  target: { appId: "sample" },
});
```

For task-owned workflows, `localKey` is required and must describe the stable
logical emission, not the current retry. Durable acceptance makes the event
visible immediately; a later workflow failure does not roll it back, and a
retry with the same key does not publish it twice.
This deduplication is within one Task generation. Across revisions or external
provider writes, use the domain operation identity and authoritative target state.

Publishing a fact does not address an owner or guarantee a reply. An App
input subscription, exact task target, or Condition must own any
actionable continuation.

Metrics are observations, not desired state:

```ts
await ctx.metrics.record("sample.verification", 1, "verified");
```

Do not let metric code mutate tasks or dispatch sessions directly.

## Pure Functions And Retry

Call pure deterministic functions normally. Keep local retries bounded by the
current run and use checks appropriate to the effect. Return useful partial
output and failed-check evidence when repair cannot continue; a loop-exhausted
message alone loses the information the caller needs. A fixed local limit can
fit a particular procedure, but no number is a universal requirement.

Local iterations share one Task attempt and its deadline. Feed the failed check's
evidence into the repair, and stop when scope, prerequisites or remaining budget
no longer permit useful work. See the
[two-loop boundary](../2a-design/workflows.md#repair-within-an-attempt).
The Host's optional final verifier runs after the workflow returns and does not
automatically feed rejection back into `execute()`. Reuse check helpers inside
the workflow where local repair is useful. Task reconciliation owns durable
retry/backoff and continuation across runs.

A restart can rerun the whole workflow, including after an agent handoff; it
does not resume the lost TypeScript continuation. Before repeating an external
write, read the provider using the operation identity retained in Task input or
use the provider's existing idempotency key. Do not generate a new operation key
from the replacement attempt or session. If the effect cannot be confirmed,
return the exact uncertainty as a blocker rather than blindly repeating it.
Keep required verification valid for both workflow and agent-produced results.

## Cross-App And Human Escalation

A workflow cannot create a durable cross-App dependency by emitting
`escalation.created`, addressing an owner string, or sending a message. Return
compact evidence and one typed dependency request in the owning task result.
The Runtime resolves the accountable child App task and wakes the parent on its
exact result.

Human attention is a child `may` task dependency or an exact human Condition on
the source task. May owns channel policy and correlated delivery.

## Repository changes and integration

Review a workflow's actual effects before giving it a worktree. Read-only
research, observation, and declared runtime scratch need no Git branch.
Versioned source, instructions, library notes, and maintained documentation
do. Keep these write classes separate.

For a repository-changing workflow:

1. Identify the actual Git root, target branch, contribution rules, and exact
   owning Task. A project subdirectory is not necessarily a standalone repo.
2. Use the Host's existing task-worktree allocation when available. Work inside
   `ctx.workspace.root`; `projectRoot` and `appRoot` identify canonical resources,
   not permission to edit a shared checkout. Preserve the recorded worktree on
   retries. Do not add another worktree manager in the App.
3. Give every implementing and reviewing call the same explicit checkout and
   scope. Run verification there too. Output admission must inspect those exact
   files, not old files at the installed canonical paths.
4. Commit a small, tested diff on the owned branch. Follow the repository's PR
   policy and required CI/live verification. Fetch and compare the target before
   integration; resolve overlaps in the owned branch, not another worker's tree.
5. Treat prepared, verified, PR-ready, merged, and deployed as distinct outcomes.
   A workflow may prove one without proving the next. No code path or prompt
   may infer merge/deploy authority from a passing command.
6. Return exact branch/commit, checks, PR when applicable, and the next action.
   A returned artifact path is a published interface: later maintenance keeps
   that exact path readable (or retains an immutable snapshot there) rather
   than silently renaming it. Improve discoverability through titles and indexes.
   Wait through a Task Condition only when no independent authorized work can
   advance. External observation should free the worker from repetitive polling.
7. Confirm integration before cleanup; retain unfinished changes and evidence.
   Do not delete another worker's branch, worktree, or dirty files.

The shared agent guidance supplies these practices for direct work as well.
Workflow implementation must still make the paths and result contract agree;
adding a worktree sentence to a prompt is not end-to-end proof. The
[workflow review](../proposals/workflow-practices-review.md) tracks the installed
Apps that have not yet met this contract.

## Shared Mechanics

Shared workflow loading is not supported. If multiple Apps need a pure
mechanism, extract an ordinary shared module. If another App owns the judgment
or outcome, request a typed dependency on that App. Do not import another App's
workflow or expose it as a live service.

## Guards

Workflow guards are pure event-to-demand functions authored through the stable
`WorkflowGuard` contract. Add one only for a repeated, precise mechanical risk
or an immediate high-impact boundary. Guards observe, warn, run a bounded step,
or block under explicit policy; they do not own retries, App requests, or task
state.

Guard evidence should remain observable through canonical trace/metric facts.
Do not add App-specific domain routing to a shared guard.

## Testing

Use `createTestAppWorkflowContext` from `@may-agent/sdk/testing` with supplied
agent/workflow results to test domain decisions without a daemon or model. Its
default agent reply has no domain output; supply the evidence needed for the
branch being checked. A status-membership assertion alone proves little.

For the review example, useful checks would include a complete negative review
remaining a completed review, incomplete findings surviving in a blocker, and a
different subject reference preventing a completion claim. For a writing workflow,
check that failed required verification prevents acceptance of the exact candidate.
Select cases that protect actual behavior; do not mirror every implementation line.

Use exact `reconciliation` fixtures for Task workflows and real SDK admission for
their returned Task output. Rely on Host tests for shared cancellation, context
isolation and result retention; add a boundary regression when a capability changes
or a real defect exposes a missing guarantee. Live trials assess method selection,
use of corrections and usefulness of results, which fake responses cannot prove.

`bun run check:may-design` type-checks the linked review example and validates the
linked Task examples. It does not run this review against a real team or establish
that all installed workflows follow this guidance.

## Integrity Checklist

- The workflow has one owner and one typed input.
- Every call is bounded to the current run.
- Normal branches return a truthful terminal contribution; failures retain available evidence.
- Durable waits use task dependencies or Conditions.
- Execution results use typed output; requirement edits use creator-scoped `ctx.reviseTask` when available.
- Cross-App outcomes use typed task dependencies; events remain facts.
- Tests use scoped fake capabilities and require no global runtime.

Use the [enforcement table](../2a-design/workflows.md#enforcement-infrastructure-and-guidance)
to distinguish required contracts from available support. This checklist does
not turn the advisory choices above into new runtime gates.

## When to promote a learned practice

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
