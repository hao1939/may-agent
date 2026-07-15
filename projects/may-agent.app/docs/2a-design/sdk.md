# AgentSDK

**Design status:** Accepted.
**Implementation status:** Implemented for runtime, event, workflow, project-app, and task-tree boundaries.

> **Update (2026-06-18):** The SDK now also exports project-app primitives:
> `defineProjectApp`, `eventDetails`, `eventData`, and `eventString`. These are
> used in `*.app/app.ts` declarations. See
> [project-app-v3.md](project-app-v3.md) §Shared SDK Boundary.
>
> The task-tree SDK (`planningPacket`, `seedModelGapBacklog`,
> `assignRunnableBacklogTasks`, etc.) is also exported for project-app
> workflows. See [task-tree-engine.md](task-tree-engine.md).

The canonical interface between agent code (handlers, workflows, gym) and the system.

The two execution calls should be understood together:

```
runAgent(agent, task, opts)       -> one agent session
runWorkflow(workflow, task, opts) -> pre-orchestrated sessions/functions
```

A workflow is not a separate kind of intelligence. It is a reusable
orchestration pattern around sessions.

## Current Interface

```typescript
interface AgentSDK {
  runAgent(agent: string, task: string, opts?: RunOpts): Promise<TaskResult>;
  runWorkflow(
    name: string,
    task: string,
    opts?: RunOpts,
  ): Promise<WorkflowResult>;
  emit(
    type: string,
    data?: Record<string, unknown>,
    envelope?: EventEnvelopeOptions,
  ): void;
  metrics: MetricAPI;
  query: QueryAPI;
  commands: CommandAPI;
  getDb(): Database; // compatibility escape hatch
  log(level: "info" | "warn" | "error", msg: string): void;
  message(target: string, content: string): void;
  escalate(reason: string, opts?: EscalationOptions): EscalationRef;
  paths: {
    persist: string;
    root: string;
    agents: string;
    shared: string;
    projects: string;
  };
}

type EventEnvelopeOptions = {
  owner?: string; // "agent:<name>" or "human:<role>"
  source?: string;
  urgency?: "low" | "normal" | "high" | "immediate";
  ttl_ms?: number;
};

type EscalationOptions = EventEnvelopeOptions & {
  requestedAction?: string;
  evidence?: Record<string, unknown>;
  severity?: "P0" | "P1" | "P2" | "P3";
  projectId?: string;
  sourceSessionId?: string;
  resume?: Record<string, unknown>;
  dedupKey?: string;
};
```

The intended surface is small: execution, events, metrics, read-only query,
typed commands, messaging, escalation, logging, and paths. `getDb()` remains
for compatibility and mechanical infra handlers, but new handler/workflow code
should prefer `query`, `commands`, and `metrics`.

`query` is read-only. State-changing helpers belong to `commands` and emit
canonical events; they must not hide writes behind a method named as a read.
Use `getDb()` only where a handler/workflow needs an escape hatch for mechanical
projection or bookkeeping, and keep those reads bounded.

## How Handlers Get It

```typescript
export const create = (ctx: HandlerContext, entry: CronEntry) => {
  return async (event?: EventEnvelope) => {
    const sdk = ctx.sdk; // ← the SDK
    await sdk.runWorkflow("metric-alert-triage", "task/context from event", {
      source: entry.name,
    });
    sdk.log("info", "done");
  };
};
```

## Method Reference

| Method                        | Does what                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `runAgent(agent, task)`       | Run one named agent session and wait for its result.                                                                                 |
| `runWorkflow(name, task)`     | Run a pre-orchestrated set of sessions/functions and wait for its result. Same execution shape as `runAgent`, broader internal plan. |
| `emit(type, data, envelope?)` | Emit a canonical event envelope. `data` carries event-specific facts; `envelope.owner` carries responsibility/routing.               |
| `metrics`                     | Define, record, alert, resolve, evaluate, and list metrics.                                                                          |
| `query`                       | Preferred bounded read surface for sessions, events, metrics, alerts, and projects.                                                  |
| `commands`                    | Typed state changes such as owner-inbox review/expiry; mutations flow through durable events.                                        |
| `getDb()`                     | Compatibility escape hatch for shared SQLite. Prefer `query`/`metrics`.                                                              |
| `log(level, msg)`             | Log a diagnostic message.                                                                                                            |
| `message(target, content)`    | Emits `message.created` — `"human"` → Telegram/web. Agent name → agent's inbox.                                                      |
| `escalate(reason, opts?)`     | Create `escalation.created`, returning `{ eventId, compatibilityId }`; defaults to `owner: "agent:may"` and `severity: "P2"`. |
| `paths`                       | `{ persist, root, agents, shared, projects }` — system directories.                                                                  |

For escalations that should return to the original session after resolution,
include `sourceSessionId` or `resume: { kind: "session", checkpointRef }`.
Terminal `escalation.resolved` events send the resolution context into the
active source session or cold-resume it. `workflowRunId` and project fields are
context for that resumed task, not direct escalation resume targets.

## Workflow Handler Helper

`@may-agent/sdk` also exports `createWorkflowHandler(options)`, the adapter that
turns a workflow into the same handler interface used by timer/event/manual
triggers. The trigger loader uses it for `handler: { workflow, agent, task }`
entries. TypeScript handlers may import it directly when they need a reusable
workflow-backed module.

```typescript
import { createWorkflowHandler } from "@may-agent/sdk";

export const create = createWorkflowHandler({
  workflow: "evaluator-aftermath",
  task: (_ctx, event) => {
    const sessionId = event?.data?.sessionId;
    return `Review completed session ${sessionId}`;
  },
  includeEvent: true,
  shouldRun: (_ctx, event) => typeof event?.data?.sessionId === "string",
});
```

`includeEvent: true` appends the exact event envelope under `## Trigger Event`.
For event subscriptions, event-specific fields stay inside `event.data`.

## WorkflowSDK

Workflows get an extended interface. **Note:** there are two `WorkflowResult`
shapes in the codebase. Workflow `.ts` files (via `WorkflowContext`) see the
**internal** shape; SDK consumers (handlers calling `sdk.runWorkflow()`) see
the **external** shape. The mapping happens in `sdk-impl.ts`.

**Internal** (what `ctx.done()` and `ctx.blocked()` return inside a workflow):

```typescript
type WorkflowResult =
  | { type: "done"; summary: string }
  | { type: "blocked"; reason: string; context?: unknown };
```

**External** (what `sdk.runWorkflow()` returns to handlers):

```typescript
interface WorkflowResult {
  status: "done" | "blocked";
  summary: string;
  runId?: string;
}
```

Workflow context interface (what workflow `execute()` functions receive):

```typescript
interface WorkflowContext {
  task: string;
  agent: string;
  done(summary: string): WorkflowResult; // internal shape, no opts
  blocked(reason: string, context?: unknown): WorkflowResult; // internal shape
  // ... plus runAgent, runWorkflow, emit, query, getDb, etc.
}
```

The external `WorkflowSDK` interface used by the legacy builder follows the
same terminal vocabulary: `done(summary, opts?)` or `blocked(reason,
context?)`. Workflow modules normally receive `WorkflowContext`; both surfaces
must remain semantically identical.

Workflow blocking is intentionally simpler than the general SDK helper because
workflow execution is synchronous. `ctx.blocked(...)` returns a terminal
`WorkflowResult` immediately. It does not automatically emit
`escalation.created` or wake another owner. The `context` parameter is
`unknown` — there is no structured `WorkflowEscalationContext` type in the
runtime. The caller/boundary decides whether the local blocked result should
be handled locally, persisted as workflow trace, or promoted into an external
owner-routed escalation event.

At the top-level workflow boundary, the runtime follows normal ownership by
returning to the most specific context owner. A blocked workflow is persisted as
`workflow_runs.status = "blocked"`. If the workflow was triggered by
`project.task.assigned`, runtime emits blocked `project.task.completed` with
`taskId`, `attemptId`, workflow lineage, reason, and compact context so the
project owner can repair the task tree. Project workflows without task context
use `project.owner.requested`. Non-project workflows use
`workflow.owner.requested`, which is handled by the default owner route for
`*.requested` events. Nested workflow blockers are returned to their parent
workflow synchronously and do not emit an owner wake by themselves.

`runAgent` and `runWorkflow` should share option semantics where possible:
source, project/session parentage, timeout, request id, and trace metadata. The
return shapes can differ, but both should answer:

- what ran,
- what status it ended with,
- what evidence/output it produced,
- where the trace can be inspected.

Target shared execution view:

Current implementation returns `TaskResult` and `WorkflowResult` directly. The
design direction is to map both into this shared view for UI, diagnostics,
tests, and resume handling; code that needs current behavior should use the
current result types above.

```typescript
interface ExecutionResult {
  id: string;
  kind: "session" | "workflow";
  status: "done" | "error" | "interrupted" | "blocked" | "escalated";
  summary: string;
  traceId: string;
  evidence?: Record<string, unknown>;
}
```

`TaskResult` and `WorkflowResult` can include more detail, but both should map
to this shape for UI, diagnostics, tests, and resume handling.
For workflows, legacy `escalated` statuses are normalized to `blocked`;
`escalated` remains only for non-workflow historical compatibility.

Resume should follow the same symmetry:

```
resumeSession(sessionId, opts) -> continue/recover one session
resumeWorkflow(runId, opts)   -> continue/recover a pre-orchestrated session tree
```

Both resume calls should preserve lineage, emit recovery/resume events, return
diagnostic status, and point to the trace. Resume is not just retry; it should
explain whether the work was resumed, already terminal, blocked, missing state,
or unsafe to continue.

## Alignment: SDK ↔ Agent Tools

The SDK and agent tools are two sides of the same coin:

| Agent thinks                      | Agent tool                        | SDK method                                                 |
| --------------------------------- | --------------------------------- | ---------------------------------------------------------- |
| "Ask dev and wait for the answer" | `agents.call("dev", task)`        | `await sdk.runAgent("dev", task)`                          |
| "Start dev in the background"     | `agents.fork("dev", task)`        | — (no SDK equivalent)                                      |
| "Something happened"              | —                                 | `sdk.emit("metric.breach", {...}, { owner: "agent:may" })` |
| "Tell humans"                     | Telegram/human message            | `sdk.message("human", msg)`                                |
| "Tell dev"                        | `message({ to: "dev", content })` | `sdk.message("dev", msg)`                                  |
| "I'm done"                        | `finish()`                        | `workflow.done(summary)`                                   |
| "Workflow cannot continue locally" | `finish({ blocked })`           | `ctx.blocked(reason)`                                      |
| "Another owner must act"          | route through owner/project     | `sdk.escalate(reason, opts)` from agent/handler SDK code   |

## Implementation

- **Types:** `projects/may-agent/src/lib/sdk.ts`
- **Package facade:** `projects/may-agent/packages/sdk/src/index.ts`
- **Wrapper:** `projects/may-agent/src/lib/sdk-impl.ts` (delegates to manager, bus, DB)
- **Wiring:** `projects/may-agent/src/app/agent-loader.ts` remains the compatibility surface over `projects/may-agent/src/app/loader/*`; handler/workflow contexts build `ctx.sdk` via `buildAgentSDK()`

## Known Limits

- `runAgent()` and `runWorkflow()` share the same mental model, but their return
  values are not yet mapped through the target `ExecutionResult` view.
- Resume is not yet symmetric across sessions and workflows.
- `getDb()` remains a compatibility escape hatch. New code should prefer
  `query` and `metrics` so infra internals can keep moving.

## Design Rationale

The SDK is the **canonical layer** for handlers and workflows. Agent tools share
the same manager/bus internals. Most agent tool actions have corresponding SDK methods;
some tool-only actions (fork, peek, cancel, context, list, sessions) exist only on the
agents tool.

Handler convention: handlers bridge events to workflows. Use
`sdk.runWorkflow(...)` by default when judgment/action is needed. Direct
`sdk.runAgent(...)` from a handler is an exception for cases where the workflow
layer would add no trace, guard, context, or test value.

```
SDK (canonical for handlers/workflows)
  ├── Agent tools use same internals (agents.call → callAgent)
  ├── Handlers dispatch workflows (ctx.sdk.runWorkflow)
  ├── Workflows call it      (ctx.sdk.runAgent)
  └── Tests call it          (adapter.runAgent)
```

**Litmus test:** if a new feature needs both handler and agent access, it should be expressible from both sides (tool AND SDK).

**Rule:** Handlers should use `ctx.sdk`, never `ctx.manager` directly. The manager is an implementation detail.
