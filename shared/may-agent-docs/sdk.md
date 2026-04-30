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
  notify(target: string, msg: string): void;
  escalate(target: string, reason: string): void;
  paths: { persist: string; root: string; agents: string };
}
```

9 methods. That's the entire capability surface.

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
| `runAgent(agent, task)` | Run a named agent, wait for result. Don't await for fire-and-forget. |
| `createLLMSession(opts)` | Raw LLM session with custom system prompt. For evaluation/judgment. |
| `emit(type, data)` | Emit a typed event (persisted to events table). |
| `getDb()` | Access the shared SQLite database. |
| `log(level, msg)` | Log a diagnostic message. |
| `notify(target, msg)` | `"human"` → Telegram/web. Agent name → agent's inbox. |
| `escalate(target, reason)` | SOS. Enters escalation chain, may trigger immediate wake. |
| `paths` | `{ persist, root, agents }` — system directories. |

## WorkflowSDK

Workflows get an extended interface:

```typescript
interface WorkflowSDK extends AgentSDK {
  task: string;
  agent: string;
  done(summary: string, opts?: { deliverables?, contextUpdates?, nextSteps? }): WorkflowResult;
  // escalate() inherited — in workflow context, also terminates the workflow
}
```

## Alignment: SDK ↔ Agent Tools

The SDK and agent tools are two sides of the same coin:

| Agent thinks | Agent tool | SDK method |
|---|---|---|
| "Ask bob to do this" | `agents.fork("bob", task)` | `sdk.runAgent("bob", task)` |
| "Something happened" | — | `sdk.emit("metric.breach", {...})` |
| "Tell humans" | Telegram tool | `sdk.notify("human", msg)` |
| "Tell bob" | `agents.notify("bob", msg)` | `sdk.notify("bob", msg)` |
| "I'm done" | `finish()` | `workflow.done(summary)` |
| "I'm stuck" | `finish({ blocked })` | `sdk.escalate("may", reason)` |

## Implementation

- **Types:** `src/lib/sdk.ts`
- **Wrapper:** `src/lib/sdk-impl.ts` (delegates to manager, bus, DB)
- **Wiring:** `src/app/agent-loader.ts` builds `ctx.sdk` via `buildAgentSDK()`

## Design Rationale

The SDK is the **canonical layer**. Agent tools are thin wrappers over it.

```
SDK (canonical)
  ├── Agent tools wrap it    (agents.fork → sdk.runAgent)
  ├── Handlers call it       (ctx.sdk.runAgent)
  ├── Workflows call it      (ctx.sdk.runAgent)
  └── Gym runner calls it    (adapter.runAgent)
```

**Litmus test:** if a new feature can't be expressed from both sides (tool AND SDK), the abstraction is wrong.
