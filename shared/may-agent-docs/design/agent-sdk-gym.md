# Design: Agent SDK

**Status**: draft
**Date**: 2026-04-28

## Problem

Handlers, workflows, and gym runners all need to interact with the agent system. Currently three overlapping interfaces expose internal implementation details (manager, bus, etc). Agents shouldn't know or care about internals.

## The SDK Interface

```typescript
interface AgentSDK {
  // Run an agent on a task, get the result
  runAgent(agent: string, task: string, opts?: RunOpts): Promise<TaskResult>;

  // Create a multi-turn session
  createSession(opts: SessionOpts): Promise<SessionHandle>;

  // Emit an event (persisted automatically)
  emit(event: Record<string, unknown>): void;

  // Access the database
  getDb(): Database;

  // Log a message
  log(msg: string): void;

  // Send a human-visible notification
  notify(msg: string): void;

  // System paths
  paths: { persist: string; root: string; agents: string };
}

interface RunOpts {
  source?: string;
  projectId?: string;
  timeout?: number;
}

interface SessionOpts {
  systemPrompt: string;
  tools: "full" | "readonly";
  label?: string;
}

interface SessionHandle {
  prompt(message: string): Promise<void>;
  lastText(): string;
  close(): void;
}

interface TaskResult {
  sessionId: string;
  status: string;
  lastAssistantText: string;
}
```

7 methods. That's the entire surface area.

## Who uses what

| Method | Handlers | Workflows | Gym runner |
|--------|----------|-----------|------------|
| runAgent | ✅ | ✅ | ✅ |
| createSession | rare | ✅ | optional |
| emit | ✅ | ✅ | ✅ |
| getDb | ✅ | ✅ | ✅ |
| log | ✅ | ✅ | ✅ |
| notify | ✅ | rare | ❌ |
| paths | ✅ | ✅ | ✅ |

## Workflow-specific additions

Workflows need two extra methods that don't belong in the base SDK:

```typescript
interface WorkflowSDK extends AgentSDK {
  done(summary: string): WorkflowResult;
  escalate(reason: string): WorkflowResult;
}
```

These are workflow lifecycle methods, not general SDK.

## Gym runner

The gym runner lives in `agents/gym/`, imports only the SDK interface, and uses an adapter:

```
agents/gym/
  runner.ts         — orchestrates scenarios using AgentSDK
  sdk-adapter.ts    — connects to the running system (socket, CLI, or stub)
  scenarios/        — test cases
```

Three adapter modes:
- **Live**: connects to the running system via socket
- **Stub**: returns canned responses (fast, no LLM cost)
- **Record/replay**: captures live responses for deterministic retesting

## What the SDK replaces

| Before (leaked internals) | After (SDK) |
|---------------------------|-------------|
| `ctx.manager.callAgent()` | `ctx.runAgent()` |
| `ctx.manager.run() + waitFor()` | `ctx.runAgent()` |
| `ctx.manager.getWorkflowDir()` | `ctx.paths.agents + "/shared/workflows"` |
| `ctx.triggerNow(name)` | `ctx.emit({ type: "trigger", handler: name })` |
| `ctx.saveWorkflowRun(run)` | internal (not exposed) |
| `ctx.trackRequest(opts)` | removed (events table) |
| `ctx.dispatchEvent(type, data)` | `ctx.emit({ event: type, ...data })` |
| `ctx.summarizeForHandoff()` | utility function, not SDK |

## Alignment: SDK ↔ Agent Tools ↔ Agent Mental Model

Two interfaces to the same system:
- **Agent (LLM)** uses tools: `agents.fork()`, `agents.notify()`, `finish()`
- **Handler/Workflow (code)** uses SDK: `runAgent()`, `notify()`, `done()`

They share the same vocabulary:

| Agent thinks | Agent tool | SDK method |
|-------------|-----------|-----------|
| "Ask bob to do this" | `agents.fork("bob", task)` | `sdk.runAgent("bob", task)` |
| "Tell bob something" | `agents.notify("bob", msg)` | `sdk.notify(msg)` |
| "Something happened" | — | `sdk.emit(event)` |
| "Look up data" | `bash("bun -e 'db.query...'")` | `sdk.getDb()` |
| "I'm done" | `finish()` | `workflow.done()` |
| "I'm stuck" | `finish({ status: "blocked" })` | `workflow.escalate()` |
| "Talk to bob over multiple turns" | — | `sdk.createSession()` |

The SDK doesn't introduce new concepts. It maps directly to what agents already understand. An agent reading handler code sees `ctx.runAgent("bob", task)` and knows exactly what it does — same as `agents.fork("bob", task)` from their tools.

## Migration

No big bang. The binary wraps its internals behind the SDK interface:

1. Define `AgentSDK` in `agents/shared/sdk.d.ts`
2. Binary provides SDK to handlers and workflows (wrapping existing internals)
3. New code uses `ctx.runAgent()`, old code keeps `ctx.manager` (deprecated)
4. Gym runner uses SDK via adapter
5. Gradually migrate, then remove deprecated APIs
