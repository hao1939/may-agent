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
| `runAgent(agent, task)` | Run a named agent, wait for result. Don't await for fire-and-forget. |
| `runWorkflow(name, task)` | Run a multi-step workflow (with guards, DB tracking, step management). |
| `createLLMSession(opts)` | Raw LLM session with custom system prompt. For evaluation/judgment. |
| `emit(type, data)` | Emit a typed event (persisted to events table). |
| `getDb()` | Access the shared SQLite database. |
| `log(level, msg)` | Log a diagnostic message. |
| `notify(target, msg)` | Emits `message.created` — `"human"` → Telegram/web. Agent name → agent's inbox. |
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
  runFunction(label: string, fn: () => Promise<string>): Promise<TaskResult>;
  createSession(opts: { systemPrompt: string; tools: "full" | "readonly"; label?: string }): Promise<SessionHandle>;
  summarize(result: TaskResult): string;
  done(summary: string, opts?: { deliverables?, contextUpdates?, nextSteps? }): WorkflowResult;
  escalate(reason: string, context?: unknown): WorkflowResult;
  dispatchEvent(type: string, data?: Record<string, unknown>): void;
}
```

## Alignment: SDK ↔ Agent Tools

The SDK and agent tools are two sides of the same coin:

| Agent thinks | Agent tool | SDK method |
|---|---|---|
| "Ask bob to do this" | `agents.fork("bob", task)` | `sdk.runAgent("bob", task)` |
| "Something happened" | — | `sdk.emit("metric.breach", {...})` |
| "Tell humans" | Telegram tool | `sdk.notify("human", msg)` |
| "Tell bob" | `message({ to: "bob", content })` | `sdk.notify("bob", msg)` |
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
  └── Tests call it          (adapter.runAgent)
```

**Litmus test:** if a new feature can't be expressed from both sides (tool AND SDK), the abstraction is wrong.
