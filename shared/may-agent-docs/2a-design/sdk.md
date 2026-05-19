# AgentSDK

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
  runWorkflow(name: string, task: string, opts?: RunOpts): Promise<WorkflowResult>;
  emit(type: string, data?: Record<string, unknown>, envelope?: EventEnvelopeOptions): void;
  metrics: MetricAPI;
  query: QueryAPI;
  getDb(): Database;  // compatibility escape hatch
  log(level: "info" | "warn" | "error", msg: string): void;
  message(target: string, content: string): void;
  escalate(reason: string, opts?: EscalationOptions): void;
  paths: { persist: string; root: string; agents: string; shared: string; projects: string };
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

The intended surface is small: execution, events, metrics, query, messaging,
escalation, logging, and paths. `getDb()` remains for compatibility and
mechanical infra handlers, but new handler/workflow code should prefer `query`
and `metrics`.

Current state: `metrics` and `query` are implemented SDK surfaces. Use `getDb()`
only where a handler/workflow needs an escape hatch for mechanical projection or
bookkeeping, and keep those reads bounded.

## How Handlers Get It

```typescript
export const create = (ctx: HandlerContext, entry: CronEntry) => {
  return async (event?: TriggerEvent) => {
    const sdk = ctx.sdk;           // ← the SDK
    await sdk.runWorkflow("metric-alert-triage", "task/context from event", {
      source: entry.name,
    });
    sdk.log("info", "done");
  };
};
```

## Method Reference

| Method | Does what |
|--------|-----------|
| `runAgent(agent, task)` | Run one named agent session and wait for its result. |
| `runWorkflow(name, task)` | Run a pre-orchestrated set of sessions/functions and wait for its result. Same execution shape as `runAgent`, broader internal plan. |
| `emit(type, data, envelope?)` | Emit a canonical event envelope. `data` carries event-specific facts; `envelope.owner` carries responsibility/routing. |
| `metrics` | Define, record, alert, resolve, evaluate, and list metrics. |
| `query` | Preferred bounded read surface for sessions, events, metrics, alerts, and projects. |
| `getDb()` | Compatibility escape hatch for shared SQLite. Prefer `query`/`metrics`. |
| `log(level, msg)` | Log a diagnostic message. |
| `message(target, content)` | Emits `message.created` — `"human"` → Telegram/web. Agent name → agent's inbox. |
| `escalate(reason, opts?)` | Create `escalation.created`; defaults to `owner: "agent:may"` and `severity: "P2"`. |
| `paths` | `{ persist, root, agents, shared, projects }` — system directories. |

For escalations that should return to the original session after resolution,
include `sourceSessionId` or `resume: { kind: "session", checkpointRef }`.
Terminal `escalation.resolved` events send the resolution context into the
active source session or cold-resume it. `workflowRunId` and project fields are
context for that resumed task, not direct escalation resume targets.

## Workflow Handler Helper

`@may-agent/sdk` also exports `createWorkflowHandler(options)`, the canonical
helper for simple cron/event-to-workflow bridges. Keep the implementation in the
SDK package; runtime/shared code should import it rather than carrying local
copies.

```typescript
import { createWorkflowHandler } from "@may-agent/sdk";

export const create = createWorkflowHandler({
  workflow: "evaluator-aftermath",
  task: (_ctx, event) => {
    const sessionId = event?.data?.data?.sessionId;
    return `Review completed session ${sessionId}`;
  },
  includeEvent: true,
  shouldRun: (_ctx, event) => typeof event?.data?.data?.sessionId === "string",
});
```

`includeEvent: true` appends the exact trigger object under `## Trigger Event`.
For event subscriptions, `event.data` is the original event envelope and
event-specific fields stay inside `event.data.data`.

## WorkflowSDK

Workflows get an extended interface:

```typescript
interface WorkflowSDK extends AgentSDK {
  task: string;
  agent: string;
  done(summary: string, opts?: { deliverables?, contextUpdates?, nextSteps? }): WorkflowResult;
  escalate(reason: string, context?: WorkflowEscalationContext): WorkflowResult;
}

type WorkflowEscalationContext = {
  owner?: string; // used only if a boundary promotes this result; boundary default is "agent:may"
  requestedAction?: string;
  evidence?: Record<string, unknown>;
  severity?: "P0" | "P1" | "P2" | "P3";
  [key: string]: unknown; // compact workflow-specific context is allowed
};
```

Workflow escalation is intentionally simpler than the general SDK helper because
workflow execution is synchronous. `ctx.escalate(...)` returns a terminal
`WorkflowResult` immediately. It does not automatically emit
`escalation.created` or wake another owner. The caller/boundary decides whether
the local escalated result should be handled locally, persisted as workflow
trace, or promoted into an external owner-routed escalation event.

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

| Agent thinks | Agent tool | SDK method |
|---|---|---|
| "Ask bob and wait for the answer" | `agents.call("bob", task)` | `await sdk.runAgent("bob", task)` |
| "Start bob in the background" | `agents.fork("bob", task)` | — (no SDK equivalent) |
| "Something happened" | — | `sdk.emit("metric.breach", {...}, { owner: "agent:may" })` |
| "Tell humans" | Telegram/human message | `sdk.message("human", msg)` |
| "Tell bob" | `message({ to: "bob", content })` | `sdk.message("bob", msg)` |
| "I'm done" | `finish()` | `workflow.done(summary)` |
| "I'm stuck" | `finish({ blocked })` | `sdk.escalate(reason)` |

## Implementation

- **Types:** `src/lib/sdk.ts`
- **Package facade:** `packages/sdk/src/index.ts`
- **Wrapper:** `src/lib/sdk-impl.ts` (delegates to manager, bus, DB)
- **Wiring:** `src/app/agent-loader.ts` remains the compatibility surface over `src/app/loader/*`; handler/workflow contexts build `ctx.sdk` via `buildAgentSDK()`

## Current Gaps To Close

- `runAgent()` and `runWorkflow()` share the same mental model, but their return
  values are not yet mapped through the target `ExecutionResult` view.
- Resume is not yet symmetric across sessions and workflows.
- `getDb()` remains a compatibility escape hatch. New code should prefer
  `query` and `metrics` so infra internals can keep moving.

## Design Rationale

The SDK is the **canonical layer** for handlers and workflows. Agent tools share
the same manager/bus internals. Most agent tool actions have corresponding SDK methods;
some tool-only actions (fork, peek, cancel, context, list, requests) exist only on the
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
