# How to Write a Workflow

This manual describes the current authoring surface. The governing capability,
discovery, provenance, and skill-composition contract is
[`workflows.md`](../2a-design/workflows.md).

## Choose A Skill Or Workflow

Use a skill when the agent should interpret a reusable method for the current
context. Use a workflow when the runtime must enforce sequencing, branching,
bounded retries, verification, and a terminal result.

A `SKILL.md` may include optional TypeScript/JavaScript helper scripts, but the
model remains the controller. A workflow's TypeScript module is the controller;
its description is discovery metadata, not executable instruction.

## Basics

A workflow is a TypeScript file in an owning app or agent workflow directory.
It exports `name`, `description`, and an `execute` function:

Workflows are deliberately synchronous: each step returns a result before the
next step runs, and `runWorkflow()` resolves only when the workflow is done or
locally blocked. Use `agents.fork` for background agent sessions outside workflow
control.

Synchronous does not mean "no `await`." It means ordered, bounded execution with
one terminal result. It is fine to await an agent, function, tool, or nested
workflow that is expected to finish within the current run.

```typescript
import type { WorkflowContext, WorkflowModule, WorkflowResult } from "@may-agent/sdk";

export const name = "my-workflow";
export const description = "Does X by coordinating dev and QA";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // 1. Run agents as steps
  const dev = await ctx.runAgent("dev", ctx.task);

  // 2. Use results to decide next steps
  if (dev.status === "error") {
    return ctx.blocked("Dev failed", { error: dev.error });
  }

  // 3. Finish
  return ctx.done(`Completed: ${dev.lastAssistantText}`);
}
```

## Durable Wait Boundary

Do not keep one workflow alive while waiting for a human, approval, timer,
external callback, unavailable dependency, or runtime restart. End the current
phase and let an event start a second synchronous workflow:

```text
workflow A
  -> persist phase and resume condition
  -> emit a domain continuation event
  -> return ctx.done("Phase A completed; continuation established")

later domain event
  -> handler validates current phase and deduplicates delivery
  -> workflow B
```

Use these rules:

- Give workflow A and workflow B separate workflow run IDs.
- Preserve the event `traceId`, causal parent, domain correlation key, and
  closure link where applicable.
- Store the waiting state and phase context in the owning app/project, not in
  workflow variables or an open agent session.
- Make workflow B reconstruct its input from durable current state.
- Make continuation handling idempotent because events may be delivered or
  reconciled more than once.
- Treat `agents.fork` only as background dispatch. If a later phase depends on
  its result, a session-result event and handler must establish that phase;
  the original workflow must not wait in memory.
- Do not map workflow A's `done` result to project-task completion. It means
  only that phase A completed and established the continuation.
- Do not return `blocked` for an expected wait. Return `blocked` only when no
  safe continuation can be established.
- Use `workflow.resume` only for crash recovery inside an interrupted
  synchronous run, never for a normal cross-event wait.

If state persistence and continuation emission cannot be atomic, use a durable
outbox or a reconciliation check that can safely emit the missing event.

## WorkflowContext

Available via `ctx`:

| Method | Description |
|--------|-------------|
| `ctx.task` | The original task string |
| `ctx.agent` | The agent that invoked this workflow |
| `ctx.runAgent(name, task)` | Run a sub-agent, wait for result |
| `ctx.runWorkflow(name, task)` | Run a sub-workflow, wait for result |
| `ctx.runFunction(label, fn)` | Run a JS function as a step (no LLM cost) |
| `ctx.summarize(result)` | Build rich context from a TaskResult for handoff |
| `ctx.createSession(opts)` | Persistent multi-turn session (worker pattern) |
| `ctx.done(summary)` | Mark workflow as successful |
| `ctx.blocked(reason, context?)` | End the workflow with a local blocked result after the workflow decides the blocker should bubble to its caller. It does not emit an external escalation event. |
| `ctx.emit(event)` | Emit a typed event |
| `ctx.dispatchEvent(type, data)` | Dispatch to handler subscribers |
| `ctx.getDb()` | Access shared SQLite database |
| `ctx.log(msg)` | Log a diagnostic message |
| `ctx.notify(msg)` | Send notification to human |

## Termination

Every workflow must end with either:
- `return ctx.done(summary)` — success
- `return ctx.blocked(reason)` — locally blocked

Never return without calling one of these.

`ctx.blocked(...)` is synchronous and terminal. The workflow stops immediately;
the caller receives `{ type: "blocked", reason, context }`. This is local to the
workflow call. The caller or handler may promote it to an external
`escalation.created` event only when the blocker must route to another owner.
For top-level workflows, the runtime routes the blocker back to the most
specific owner of context. If the workflow was triggered by
`project.task.assigned`, runtime emits blocked `project.task.completed`; the
task tree is the recovery target. Project workflows without task context use
`project.owner.requested`. Non-project workflows use `workflow.owner.requested`,
which follows the default owner route. Nested workflows return the blocked
result to their parent workflow synchronously; the nested workflow does not wake
the owner directly.

Because workflow execution is synchronous, a workflow can handle a blocker
inside the workflow before returning: run a repair step, ask another agent with
`ctx.runAgent`, run a sub-workflow, retry, verify, or notify. Use
`ctx.blocked(...)` only when the workflow has reached a terminal local blocker
and wants the caller to decide whether to record it, retry another path, or
promote it outside the workflow boundary.

Do not make the workflow wait for an external human/owner response after it has
returned `ctx.blocked(...)`. If human/owner routing is required, the caller or
runtime boundary should promote the local result to `escalation.created`.

Typical blocker paths:

| Situation inside workflow | Preferred action |
|---------------------------|------------------|
| A step failed but the next fix is clear | Run a repair step, retry, then verify |
| Another agent can answer synchronously | Use `ctx.runAgent(...)` and continue with its result |
| A reusable recipe should handle the problem | Use `ctx.runWorkflow(...)` and continue or return based on its result |
| A human/operator should see context but no response is required during this run | Use `ctx.notify(...)` and continue or finish with an honest summary |
| The workflow cannot safely decide the next action | `return ctx.blocked(reason, context)` and let the caller/boundary decide |
| A top-level task workflow blocks | Runtime persists `workflow_runs.status = "blocked"` and emits blocked `project.task.completed` with task/workflow lineage |
| A top-level non-task workflow blocks | Runtime persists `workflow_runs.status = "blocked"` and wakes the project or workflow owner with lineage |
| The blocker crosses an ownership boundary after the workflow returns | Caller/boundary may emit `escalation.created`; the workflow itself should not |

Use the second argument only for compact boundary context. It may become
owner-facing context later if the caller promotes the result to an external
escalation:

```typescript
return ctx.blocked("Missing sessionId", {
  requestedAction: "Fix the session.end emitter to include sessionId.",
  evidence: { trigger: event },
});
```

## Patterns

### Implement → Verify (shell gate)

```typescript
const dev = await ctx.runAgent("dev", task);
const verify = await ctx.runFunction("verify", async () => {
  const { execSync } = await import("node:child_process");
  execSync("tsc --noEmit && bun test", { encoding: "utf-8" });
  return "PASS";
});
if (verify.status === "error") {
  return ctx.blocked("Verification failed", { output: verify.lastAssistantText });
}
return ctx.done("Implemented and verified");
```

### Implement → Review (agent gate)

```typescript
const dev = await ctx.runAgent("dev", task);
const reviewTask = `Review this:\n\n${ctx.summarize(dev)}`;
const review = await ctx.runAgent("qa", reviewTask);

if (review.lastAssistantText.includes("FAIL")) {
  // Retry with feedback
  const fixTask = `Fix based on review:\n${review.lastAssistantText}\n\nOriginal: ${task}`;
  await ctx.runAgent("dev", fixTask);
}
return ctx.done("Implemented and reviewed");
```

### Multi-turn Session (worker pattern)

```typescript
const worker = await ctx.createSession({
  systemPrompt: "You are a code reviewer. Be thorough.",
  tools: "readonly",
  label: "reviewer",
});

await worker.prompt("Review src/lib/manager.ts for error handling issues");
const issues = worker.lastText();

await worker.prompt(`Now prioritize these issues: ${issues}`);
const prioritized = worker.lastText();

worker.close();
return ctx.done(prioritized);
```

### Retry Loop

```typescript
const MAX_ATTEMPTS = 2;
for (let i = 1; i <= MAX_ATTEMPTS; i++) {
  const result = await ctx.runAgent("dev", i === 1 ? task : fixTask);
  const verify = runVerification();
  if (verify.passed) return ctx.done("Verified");
  fixTask = `Fix errors:\n${verify.output}\n\nOriginal: ${task}`;
}
return ctx.blocked("Failed after all attempts");
```

## Invoking a Workflow

From an agent (LLM tool):
```
workflow({ action: "run", name: "implement-and-verify", task: "Add retry logic" })
```

From handler/SDK code:
```typescript
const result = await ctx.runWorkflow("implement-and-verify", task);
```

## Workflow Location

Put workflows next to the owner that operates them:

| Location | Visibility | Use case |
|----------|------------|----------|
| `projects/<id>.app/workflows/` | That project app's workflow loader | Project-app owner, worker, problem-solver, focus-plan, and project-specific domain workflows |
| `agents/<name>/workflows/` | That standalone agent's workflow loader | Agent-owned workflows such as heartbeat, metric alert triage, or infra-wide compatibility workflows |

For project-specific behavior, prefer the app-local workflow. Global May
handlers may deliver events or provide compatibility backstops, but they should
not own another app's planning packet, task assignment policy, or domain repair
logic.

Shared workflow loading is not supported. If more than one owner needs the same
pattern, keep the workflow owned by the app/agent that operates it and have
other callers invoke that owner through the SDK/tool boundary, or factor
reusable mechanics into a normal shared helper module that an app-local or
agent-owned workflow imports.

Keep the flat `<name>.ts` form. Do not create a workflow directory package or
make Markdown executable; the current loader does not define either contract.

## Guards (Advanced)

Workflows can have guards that react to step events:

```typescript
export const guard: WorkflowGuard = {
  name: "budget-check",
  events: ["step_done"],
  handle(event) {
    if (event.completedSteps.length > 5) {
      return [{ type: "block", reason: "Too many steps — budget exceeded" }];
    }
    return [];
  },
};
```

Guards are pure functions: event in → demands out. Do not add one just because
a session looked bad once. Default to metrics or evaluator review first; add a
guard only after the signal is repeated and precise, or when the risk is
high-impact enough to prevent immediately. Current demand types are `warn`,
`run_step`, and `block`. The design target also includes an `observe` mode for
recording a guard signal without interrupting work.

By convention, every guard trigger should be observable through a
`guard.triggered` event. The default guard handler owns common metrics such as
guard trigger/warn/block counts, so individual workflow authors should not add
custom metric plumbing unless the guard needs behavior beyond the default.

## Testing

```bash
# Run workflow via CLI
bun src/app/may.ts --run-workflow implement-and-verify "fix the type error"

# Or invoke from a handler/workflow test
bun test projects/<id>.app/workflows/my-workflow.test.ts
bun test agents/<name>/workflows/__tests__/my-workflow.test.ts
```
