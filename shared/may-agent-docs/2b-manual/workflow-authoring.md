# How to Write a Workflow

## Basics

A workflow is a TypeScript file in `agents/<name>/workflows/`. It exports `name`,
`description`, and an `execute` function:

Workflows are deliberately synchronous: each step returns a result before the
next step runs, and `runWorkflow()` resolves only when the workflow is done or
escalated. Use `agents.fork` for background agent sessions outside workflow
control.

```typescript
import type { WorkflowContext, WorkflowModule, WorkflowResult } from "../../shared/agent-sdk.ts";
import type { TaskResult } from "../../shared/agent-sdk.ts";

export const name = "my-workflow";
export const description = "Does X by coordinating coder and QA";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // 1. Run agents as steps
  const coder = await ctx.runAgent("coder", ctx.task);

  // 2. Use results to decide next steps
  if (coder.status === "error") {
    return ctx.escalate("Coder failed", { error: coder.error });
  }

  // 3. Finish
  return ctx.done(`Completed: ${coder.lastAssistantText}`);
}
```

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
| `ctx.escalate(reason, context?)` | End the workflow with a local escalated result after the workflow decides the blocker should bubble to its caller. It does not emit an external escalation event. |
| `ctx.emit(event)` | Emit a typed event |
| `ctx.dispatchEvent(type, data)` | Dispatch to handler subscribers |
| `ctx.getDb()` | Access shared SQLite database |
| `ctx.log(msg)` | Log a diagnostic message |
| `ctx.notify(msg)` | Send notification to human |

## Termination

Every workflow must end with either:
- `return ctx.done(summary)` — success
- `return ctx.escalate(reason)` — failure/blocked

Never return without calling one of these.

`ctx.escalate(...)` is synchronous and terminal. The workflow stops immediately;
the caller receives `{ type: "escalate", reason, context }`. This is local to the
workflow call. The caller or handler may promote it to an external
`escalation.created` event only when the blocker must route to another owner.

Because workflow execution is synchronous, a workflow can handle a blocker
inside the workflow before returning: run a repair step, ask another agent with
`ctx.runAgent`, run a sub-workflow, retry, verify, or notify. Use
`ctx.escalate(...)` only when the workflow has reached a terminal local blocker
and wants the caller to decide whether to record it, retry another path, or
promote it outside the workflow boundary.

Do not make the workflow wait for an external human/owner response after it has
returned `ctx.escalate(...)`. If human/owner routing is required, the caller or
runtime boundary should promote the local result to `escalation.created`.

Typical blocker paths:

| Situation inside workflow | Preferred action |
|---------------------------|------------------|
| A step failed but the next fix is clear | Run a repair step, retry, then verify |
| Another agent can answer synchronously | Use `ctx.runAgent(...)` and continue with its result |
| A reusable recipe should handle the problem | Use `ctx.runWorkflow(...)` and continue or return based on its result |
| A human/operator should see context but no response is required during this run | Use `ctx.notify(...)` and continue or finish with an honest summary |
| The workflow cannot safely decide the next action | `return ctx.escalate(reason, context)` and let the caller/boundary decide |
| The blocker crosses an ownership boundary after the workflow returns | Caller/boundary may emit `escalation.created`; the workflow itself should not |

Use the second argument only for compact boundary context. It may become
owner-facing context later if the caller promotes the result to an external
escalation:

```typescript
return ctx.escalate("Missing sessionId", {
  requestedAction: "Fix the session.completed emitter to include sessionId.",
  evidence: { trigger: event },
});
```

## Patterns

### Implement → Verify (shell gate)

```typescript
const coder = await ctx.runAgent("coder", task);
const verify = await ctx.runFunction("verify", async () => {
  const { execSync } = await import("node:child_process");
  execSync("tsc --noEmit && bun test", { encoding: "utf-8" });
  return "PASS";
});
if (verify.status === "error") {
  return ctx.escalate("Verification failed", { output: verify.lastAssistantText });
}
return ctx.done("Implemented and verified");
```

### Implement → Review (agent gate)

```typescript
const coder = await ctx.runAgent("coder", task);
const reviewTask = `Review this:\n\n${ctx.summarize(coder)}`;
const review = await ctx.runAgent("qa", reviewTask);

if (review.lastAssistantText.includes("FAIL")) {
  // Retry with feedback
  const fixTask = `Fix based on review:\n${review.lastAssistantText}\n\nOriginal: ${task}`;
  await ctx.runAgent("coder", fixTask);
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
  const result = await ctx.runAgent("coder", i === 1 ? task : fixTask);
  const verify = runVerification();
  if (verify.passed) return ctx.done("Verified");
  fixTask = `Fix errors:\n${verify.output}\n\nOriginal: ${task}`;
}
return ctx.escalate("Failed after all attempts");
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

Put workflows under the owning agent:

| Location | Visibility | Use case |
|----------|------------|----------|
| `agents/<name>/workflows/` | That agent's workflow loader | Agent-owned workflows such as heartbeat, project iteration, metric alert triage, or domain workflows |

Shared workflow loading is not supported. If more than one agent needs the same
pattern, keep the workflow owned by the agent that operates it and have other
callers invoke that owner through the SDK/tool boundary, or factor reusable code
into a normal shared helper module that an agent-owned workflow imports.

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

Guards are pure functions: event in → demands out. Treat them as detectors
first: record risk signals, warn the next step, inject repair steps, or block
only when the risk is high-confidence and high-impact. Current demand types are
`warn`, `run_step`, and `block`. The design target also includes an `observe`
mode for recording a guard signal without interrupting work.

By convention, every guard trigger should be observable through a
`guard.triggered` event. The default guard handler owns common metrics such as
guard trigger/warn/block counts, so individual workflow authors should not add
custom metric plumbing unless the guard needs behavior beyond the default.

## Testing

```bash
# Run workflow via CLI
bun src/app/may.ts --run-workflow implement-and-verify "fix the type error"

# Or invoke from a handler test
bun test agents/<name>/workflows/__tests__/my-workflow.test.ts
```
