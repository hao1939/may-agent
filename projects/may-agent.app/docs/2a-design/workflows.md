# Workflow Discovery And Execution

**Design status:** Accepted.
**Implementation status:** Implemented for validated per-invocation catalog
snapshots, project-over-agent precedence, entry-file provenance, durable
lifecycle events, guards, nesting, and revision/task-safe resume. Full imported
dependency fingerprints and registration-time catalog reloads remain follow-up.
Workflows remain ordered synchronous blocks; durable waits split across
event-linked runs.

## Purpose

A workflow is executable orchestration for a repeatable process. It moves
sequencing, branching, retries, verification, and terminal-result handling out
of model memory and into runtime-controlled TypeScript.

A workflow is not a prompt document and is not merely an arbitrary script:

- its TypeScript module is the executable controller;
- its `name` and `description` form the discovery surface;
- its `execute(ctx)` function uses the bounded workflow SDK;
- its `workflowRunId`, steps, events, and terminal result make execution
  durable and inspectable.

The event, project task, or human intent that wakes a workflow remains the
upstream work identity. The workflow run is the execution identity. Do not add
a parallel request type to represent either one.

## Skill And Workflow Boundary

Skills and workflows share a resource architecture, not execution semantics.

| Concern | Skill | Workflow |
|---|---|---|
| Primary source | `SKILL.md` instructions | TypeScript module |
| Controller | Model judgment | Workflow runtime |
| Unit of use | One model turn | Durable workflow run |
| Selection | Model match or explicit invocation | Explicit tool, SDK, handler, or schedule invocation |
| Sequencing | Advisory | Enforced by code |
| State and closure | Enclosing session/work owns it | `workflowRunId` and terminal workflow result |
| Optional code | Helper scripts run through normal tools | Imported helpers or `ctx.runFunction(...)` steps |
| Best fit | Variable, judgment-heavy method | Repeatable, testable orchestration |

A script bundled with a skill does not make the skill a workflow. The model
still decides whether and how to run that helper. Conversely, prose beside a
workflow documents the executable contract but does not control execution.

## Shared Capability Resource Contract

Skill and workflow loaders should expose the same small resource envelope:

```ts
type CapabilityResource = {
  kind: "skill" | "workflow";
  name: string;
  description: string;
  scope: "app-agent" | "project-app" | "agent" | "shared";
  filePath: string;
  contentHash: string;
};
```

This shared envelope supports consistent discovery, precedence, compact
catalogs, diagnostics, reloads, trace provenance, and evaluation. Each kind
retains its own validator, invocation API, permissions, and lifecycle.

Do not build one generic executor for both. A capability catalog may present
both kinds to operators, but it must preserve `kind` and route invocation to
the correct runtime.

`contentHash` covers the primary resource for catalog identity. For a skill,
that is the resolved `SKILL.md` body. For a workflow, exact run provenance must
also fingerprint repository-local modules reachable from the entrypoint and
the dependency-lock revision. A workflow entry-file hash alone is useful
diagnostic evidence but must not be described as the complete executable
revision.

## Module Contract

The canonical v1 workflow remains a flat TypeScript file:

```text
projects/<id>.app/workflows/<name>.ts
agents/<agent>/workflows/<name>.ts
```

```ts
import type {
  WorkflowContext,
  WorkflowResult,
} from "@may-agent/sdk";

export const name = "implement-and-verify";
export const description = "Implement a change, run deterministic checks, and return the verified result.";

export async function execute(
  ctx: WorkflowContext,
): Promise<WorkflowResult> {
  const implementation = await ctx.runAgent("dev", ctx.task);
  if (implementation.status === "error") {
    return ctx.blocked("Implementation failed", {
      sessionId: implementation.sessionId,
    });
  }

  const verification = await ctx.runFunction("verify", async () => {
    const { execSync } = await import("node:child_process");
    return execSync("bun test", { encoding: "utf8" });
  });
  if (verification.status === "error") {
    return ctx.blocked("Verification failed", {
      output: verification.lastAssistantText,
    });
  }

  return ctx.done("Implemented and verified");
}
```

Rules:

- Prefer TypeScript/JavaScript and Bun for workflow code and helpers.
- Require explicit `name`, `description`, and `execute` exports. The active
  catalog does not derive missing names or descriptions from filenames.
- End every path with `ctx.done(...)` or `ctx.blocked(...)`.
- Use `ctx.runAgent`, `ctx.runWorkflow`, and `ctx.runFunction` so steps remain
  visible to guards, persistence, and traces.
- Keep reusable deterministic mechanics in normal TypeScript modules and
  import them. Do not place orchestration state in Markdown.
- Keep tests beside the workflow or in the owning app's established test
  layout.

Flat files remain the canonical format because most workflows need no private
resource bundle. If repeated cases require workflow-private references,
fixtures, or helpers, a later design may add `workflows/<name>/workflow.ts`.
Do not migrate existing workflows until that need and loader contract exist.

## Scope And Precedence

For a project-scoped call, resolve workflows in this order:

| Priority | Scope | Location |
|---:|---|---|
| 1 | Owning project app | `projects/<id>.app/workflows/<name>.ts` |
| 2 | Calling standalone agent | `agents/<agent>/workflows/<name>.ts` |

The project workflow replaces an agent workflow with the same effective name;
workflows never merge. Shared workflow discovery is intentionally unsupported.
Cross-owner reuse should use an explicit SDK/tool boundary, or a shared helper
module imported by separately owned workflows.

The effective name is the exported `name`, not only the filename. Duplicate
effective names within one scope are invalid. Discovery must report and omit
an ambiguous name instead of selecting it by directory order. A closer-scope
workflow may intentionally override one valid farther-scope workflow.

## Discovery And Reload

The current lifecycle is:

```text
workflow roots at list/run/resume
  -> enumerate TypeScript entrypoints
  -> import and validate exports
  -> resolve effective-name precedence
  -> immutable workflow catalog snapshot
  -> list or explicit invocation
```

Missing roots are empty, not errors. Invalid modules and duplicate effective
names appear in catalog diagnostics and are not invocable. `list`, `run`, and
`resume` resolve through the same immutable snapshot for that tool call, so a
valid edit is picked up by the next dispatch. A run persists the selected entry
path, scope, and entry hash.

A later optimization may build catalogs at registration and replace them on
reload or source change. It must preserve next-dispatch freshness and must not
change code beneath an active run.

## Invocation And Lifecycle

Workflow execution is always explicit:

```text
workflow({ action: "run", name, task })
ctx.runWorkflow(name, task)
handler or schedule -> sdk.runWorkflow(name, task)
```

A description may help an agent choose a workflow, but merely matching a
description must not start code. Event handlers and schedules own automatic
wake-up policy.

All callers use the same typed runner. Agent-facing `workflow(...)` serializes
the typed result only at the tool boundary; project handlers and SDK calls
consume that result directly. Internal callers must not invoke the model tool
and parse its JSON text to recover workflow state.

## Synchronous Execution And Durable Waits

A workflow is a compact synchronous block. Synchronous describes its control
contract, not whether its TypeScript uses `await`: steps execute in declared
order, each step resolves before the next begins, and the caller receives one
terminal result from that run.

Keep a wait inside one workflow only when it is bounded and expected to resolve
within the current execution, such as:

- an agent step with a configured timeout;
- a deterministic function or tool call;
- a nested workflow that itself returns `done` or `blocked`; or
- a bounded retry whose limit and terminal condition are explicit.

Do not suspend a workflow across a human reply, approval, timer, external
callback, unavailable dependency, runtime restart, or any wait with no useful
in-process bound. Split that process into event-linked synchronous phase
workflows:

```text
trigger event
  -> workflow A: perform phase A in order
  -> persist domain phase + resume condition
  -> emit domain continuation event
  -> workflow A returns done

durable wait: no workflow is running

reply / timer / callback / condition event
  -> handler validates and deduplicates the continuation
  -> workflow B: perform phase B in order
  -> workflow B returns done or blocked
```

Workflow A and workflow B have different `workflowRunId` values. They are not
nested runs. Connect them with the existing event trace, the domain object's
stable correlation key, and the persisted phase state. Preserve the original
`traceId`; make the continuation event the causal parent of the later phase,
and add a closure link when the later event closes an earlier commitment.

The app or project owns the durable state machine. Persist enough context to
reconstruct phase B from current state; do not depend on workflow-local
variables, an open session, or module memory. Prefer a transactional outbox or
equivalent atomic state-and-event write when losing the continuation event
would strand work. Otherwise provide an idempotent reconciler that can re-emit
the missing event safely.

Use an existing meaningful domain event such as an approval result, artifact
availability, task transition, or timer signal. Do not introduce a generic
workflow-wait request object or parallel request lifecycle merely to connect
the phases.

`ctx.done(...)` from workflow A means that phase A and its continuation handoff
completed successfully. It does not mean the enclosing project goal or task is
done. The app boundary must keep that domain object in `waiting`,
`pending-review`, or another truthful state until the later phase produces its
actual terminal evidence.

An expected durable wait is not `ctx.blocked(...)`. Use `blocked` only when the
current run cannot safely choose or establish a continuation. Do not add a
`waiting` workflow result or keep a workflow run open: waiting belongs to the
domain/app state and the event system.

`workflow.resume` remains crash recovery for an interrupted synchronous run.
It must not be used to continue a business process after an expected durable
wait. Start the later phase as a new workflow run from its triggering event.

Each run has one durable `workflowRunId` and inherits the causal trace of its
trigger. It persists parent session/workflow links, project scope, step
sessions, status, and terminal summary or reason. Terminal outcomes are:

- `done` via `ctx.done(summary)`;
- `blocked` via `ctx.blocked(reason, context)`;
- runtime interruption or error, recorded by the runtime.

A local blocked result is not automatically a cross-owner escalation. The
top-level caller or runtime boundary decides whether to wake the task owner,
workflow owner, or escalation path. Nested workflows return their result to
their parent synchronously.

Resume creates a new run linked to the prior run. It must resolve the same
workflow identity deliberately. If the original content hash is unavailable,
or the current source differs, the runtime should expose that fact and require
the workflow's declared compatibility policy rather than silently claiming an
identical continuation. This link represents recovery lineage, not a durable
business-process wait.

## Provenance And Evaluation

Persist this source snapshot with each workflow run today:

```ts
type WorkflowSource = {
  scope: "project" | "agent";
  filePath: string;
  entryContentHash: string;
};
```

The entry hash supports revision-safe replay but is not a complete executable
fingerprint. A future `executableHash` should cover the entrypoint,
repository-local imported source graph, and dependency-lock revision. Include
the workflow name, run ID, and available revision hash in lifecycle trace
evidence. A hash identifies controller source; it is not a lifecycle entity or
completion event.

Evaluate workflows from existing run and step evidence: completion/block/error
rate, duration, retries, guard interventions, model/tool cost, and downstream
task closure. Entry-hash comparisons are useful today; use the future
executable hash for rigorous revision comparisons. Do not let a workflow
declare its own effectiveness merely because it returned `done`.

## Composing Skills Into Workflows

A workflow may invoke an agent with a named skill when a step needs a reusable
judgment method. The target SDK shape is:

```ts
ctx.runAgent("qa", reviewTask, { skill: "verify-change" });
```

The receiving agent's skill catalog resolves the name, and the resulting
`skill.loaded` evidence remains within that step session's trace. The workflow
stores only the skill name, not a copied skill body. This option is a gap until
the skill invocation contract and workflow SDK both support it.

Use the composition in this direction:

```text
workflow controls sequence
  -> agent step uses a skill for judgment
  -> workflow consumes the step result
  -> workflow returns one terminal result
```

Do not ask a skill to simulate durable workflow state, retries, or completion.

## Promotion Heuristic

Promote a skill or repeated practice into a workflow only when evidence shows
that:

- the sequence should be consistent across runs;
- missing or reordering steps creates meaningful risk;
- inputs, outputs, and terminal conditions can be made explicit;
- deterministic checks or bounded retries improve reliability; and
- the process is stable enough to justify code and tests.

Keep the capability as a skill when context changes the right sequence, human
judgment dominates, or the process is still being learned. "Runs often" alone
is not evidence that a skill should become a workflow; a schedule may simply
invoke a skill-bearing session.

## Known Limits

Preserve the current workflow runtime and close these gaps incrementally:

1. Add a complete executable hash over local imports and the dependency lock;
   keep the entry hash for direct source evidence.
2. If performance requires it, move catalog construction to registration and
   reload without losing next-dispatch freshness or snapshot safety.
3. Add the optional `skill` field to workflow agent steps and trace it through
   the receiving session.
4. Add an integration fixture for a durable wait: phase A persists state and
   emits the continuation, phase B starts from a later event with a distinct
   run ID in the same trace, and phase-A completion does not close the project
   task.

These changes strengthen discovery and evidence. They do not replace the
TypeScript executor, create workflow request types, or turn Markdown into code.
No asynchronous or suspended workflow executor is planned; events compose the
synchronous blocks across durable waits.
