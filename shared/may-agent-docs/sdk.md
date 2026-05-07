# AgentSDK

The canonical interface between agent code (handlers, workflows, gym) and the system.

## The Interface

```typescript
interface AgentSDK {
  runAgent(agent: string, task: string, opts?: RunOpts): Promise<TaskResult>;
  runWorkflow(name: string, task: string, opts?: RunOpts): Promise<WorkflowResult>;
  createLLMSession(opts: SessionOpts): Promise<SessionHandle>;
  emit(type: string, data?: Record<string, unknown>): void;
  getDb(): Database;
  log(level: "info" | "warn" | "error", msg: string): void;
  message(target: string, content: string): void;
  escalate(target: string, reason: string): void;
  paths: { persist: string; root: string; agents: string };
}
```

8 methods + 1 property. That's the entire capability surface.

## How Handlers Get It

```typescript
export const create = (ctx: HandlerContext, entry: CronEntry) => {
  return async (event?: TriggerEvent) => {
    const sdk = ctx.sdk;           // ← the SDK
    const db = sdk.getDb();
    sdk.emit("handler.completed", { handler: entry.name });
    sdk.log("info", "done");
  };
};
```

## Method Reference

| Method | Does what |
|--------|-----------|
| `runAgent(agent, task)` | Run a named agent and wait for its result. |
| `runWorkflow(name, task)` | Run a multi-step workflow and wait for completion. Workflows are synchronous by design. |
| `createLLMSession(opts)` | Reserved. Currently throws `createLLMSession not yet implemented`. |
| `emit(type, data)` | Emit a typed event (persisted to events table). |
| `getDb()` | Access the shared SQLite database. |
| `log(level, msg)` | Log a diagnostic message. |
| `message(target, content)` | Emits `message.created` — `"human"` → Telegram/web. Agent name → agent's inbox. |
| `escalate(target, reason)` | SOS. Enters escalation chain, may trigger immediate wake. |
| `paths` | `{ persist, root, agents }` — system directories. |

## WorkflowSDK

Workflows get an extended interface:

```typescript
interface WorkflowSDK extends AgentSDK {
  task: string;
  agent: string;
  runAgent(agent: string, task: string): Promise<TaskResult>;
  runWorkflow(name: string, task: string): Promise<WorkflowResult>;
  done(summary: string, opts?: { deliverables?, contextUpdates?, nextSteps? }): WorkflowResult;
  escalate(target: string, reason: string): void;
}
```

## Alignment: SDK ↔ Agent Tools

The SDK and agent tools are two sides of the same coin:

| Agent thinks | Agent tool | SDK method |
|---|---|---|
| "Ask bob and wait for the answer" | `agents.call("bob", task)` | `await sdk.runAgent("bob", task)` |
| "Start bob in the background" | `agents.fork("bob", task)` | No `AgentSDK` method today; handlers can use `ctx.manager.runAgent(...)` when they intentionally need a background session. |
| "Something happened" | — | `sdk.emit("metric.breach", {...})` |
| "Tell humans" | Telegram/human message | `sdk.message("human", msg)` |
| "Tell bob" | `message({ to: "bob", content })` | `sdk.message("bob", msg)` |
| "I'm done" | `finish()` | `workflow.done(summary)` |
| "I'm stuck" | `finish({ blocked })` | `sdk.escalate("may", reason)` |

## Implementation

- **Types:** `src/lib/sdk.ts`
- **Wrapper:** `src/lib/sdk-impl.ts` (delegates to manager, bus, DB)
- **Wiring:** `src/app/agent-loader.ts` builds `ctx.sdk` via `buildAgentSDK()`

## Design Rationale

The SDK is the **canonical layer** for handlers and workflows. Agent tools share
the same manager/bus internals, but not every tool action has a one-to-one SDK
method yet.

```
SDK (canonical)
  ├── Agent tools use same internals (agents.call → callAgent, agents.fork → runAgent)
  ├── Handlers call it       (await ctx.sdk.runAgent)
  ├── Workflows call it      (await ctx.sdk.runAgent)
  └── Tests call it          (adapter.runAgent)
```

**Litmus test:** if a new feature can't be expressed from both sides (tool AND SDK), the abstraction is wrong.
