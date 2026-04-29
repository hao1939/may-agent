# Design: Agent SDK

**Status**: draft
**Date**: 2026-04-28

## Problem

Handlers, workflows, and gym runners all need to interact with the agent system. Currently three overlapping interfaces expose internal implementation details. Agents shouldn't know or care about internals.

## The SDK Interface

```typescript
interface AgentSDK {
  // Run an agent on a task, wait for result
  runAgent(agent: string, task: string, opts?: RunOpts): Promise<TaskResult>;

  // Create a raw LLM session (multi-turn, custom system prompt)
  // NOT "talk to another agent" — use runAgent() for that
  createLLMSession(opts: SessionOpts): Promise<SessionHandle>;

  // Emit a typed event (persisted to events table)
  emit(type: string, data?: Record<string, unknown>): void;

  // Access the shared database
  getDb(): Database;

  // Log a diagnostic message
  log(msg: string): void;

  // Send a notification to a target (agent name or "human")
  notify(target: string, msg: string): void;

  // Escalate to a target — I'm stuck, need help (enters escalation chain)
  escalate(target: string, reason: string): void;

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

8 methods. That's the entire surface area.

## Who uses what

| Method | Handlers | Workflows | Gym runner |
|--------|----------|-----------|------------|
| runAgent | ✅ | ✅ | ✅ |
| createLLMSession | rare | ✅ | optional |
| emit | ✅ | ✅ | ✅ |
| getDb | ✅ | ✅ | ✅ |
| log | ✅ | ✅ | ✅ |
| notify | ✅ | rare | ❌ |
| escalate | ✅ | ✅ | ❌ |
| paths | ✅ | ✅ | ✅ |

## Workflow-specific additions

Workflows need two lifecycle methods not in the base SDK:

```typescript
interface WorkflowSDK extends AgentSDK {
  task: string;
  agent: string;
  // done() terminates the workflow successfully
  done(summary: string, opts?: { deliverables?: Deliverable[]; contextUpdates?: string[]; nextSteps?: string[] }): WorkflowResult;
  // Note: escalate() is inherited from AgentSDK.
  // In workflow context, escalate(target, reason) also terminates the workflow.
}
```

## Alignment: SDK ↔ Agent Tools ↔ Agent Mental Model

Two interfaces to the same system:
- **Agent (LLM)** uses tools: `agents.fork()`, `agents.notify()`, `finish()`
- **Handler/Workflow (code)** uses SDK: `runAgent()`, `emit()`, `done()`

They share the same vocabulary:

| Agent thinks | Agent tool | SDK method |
|-------------|-----------|-----------|
| "Ask bob to do this" | `agents.fork("bob", task)` | `sdk.runAgent("bob", task)` |
| "Tell the system something happened" | — | `sdk.emit("metric.breach", { metric, value })` |
| "Send a message to humans" | `finish({ notify })` / Telegram tool | `sdk.notify("human", msg)` |
| "Look up data" | `bash("bun -e 'db.query...'")` | `sdk.getDb()` |
| "I'm done" | `finish()` | `workflow.done()` |
| "Tell bob something" | `agents.notify("bob", msg)` | `sdk.notify("bob", msg)` |
| "I'm stuck" | `finish({ status: "blocked" })` | `sdk.escalate("may", reason)` |
| "Run an LLM with custom prompt" | — | `sdk.createLLMSession()` |
| "Trigger a handler now" | — | `sdk.emit("trigger.metrics-snapshot")` (convention: `trigger.<handler-name>`) |

Notes:
- `notify(target, msg)` sends to any target. `notify("human", msg)` goes to Telegram/web. `notify("bob", msg)` goes to bob's inbox.
- `createLLMSession()` creates a raw LLM session with custom system prompt — NOT "talk to another agent". For multi-turn agent interaction, call `runAgent()` multiple times with accumulated context.
- `getDb()` is the database primitive. Inbox, metrics, sessions are all queries on top — no special helpers in the SDK.

## What the SDK replaces

| Before (leaked internals) | After (SDK) |
|---------------------------|-------------|
| `ctx.manager.callAgent()` | `sdk.runAgent()` |
| `ctx.manager.run() + waitFor()` | `sdk.runAgent()` (don't await for fork) |
| `ctx.manager.getWorkflowDir()` | `sdk.paths.agents + "/shared/workflows"` |
| `ctx.dispatchEvent(type, data)` | `sdk.emit(type, data)` |
| `ctx.emit({ type, ... })` | `sdk.emit(type, data)` |

## Gym runner

```
agents/gym/
  runner.ts         — orchestrates scenarios using AgentSDK
  sdk-adapter.ts    — connects to the running system
  scenarios/        — test cases (already here)
```

Adapter modes:
- **Stub**: canned responses, no LLM cost, fast testing
- **In-process**: direct function call (current gym approach, requires bundled binary)
- **Live via socket**: connects to running may-agent socket (aspirational — socket exists but needs runAgent command added)

## The SDK is the canonical layer

The SDK defines the system's capability surface. Agent tools are thin wrappers over it.

```
SDK (canonical)
  ├── Agent tools wrap it    (agents.fork → sdk.runAgent)
  ├── Handlers call it       (ctx.runAgent → sdk.runAgent)
  ├── Workflows call it      (ctx.runAgent → sdk.runAgent)
  └── Gym runner calls it    (adapter.runAgent → sdk.runAgent)
```

Today it's inverted — tools and handlers call `manager.callAgent()` directly, bypassing any shared layer. Flipping it so everything goes through the SDK means:

- **Testing**: mock the SDK, test tool/handler logic in isolation
- **Consistency**: behavior identical whether called by LLM tool or handler code
- **Capability surface**: 8 methods = 7 things the system can do. Everything else is internal.

**Litmus test for new features**: if you can't express it naturally from both sides (agent tool AND SDK method), something's wrong with the abstraction.

## What the SDK does NOT do

Intentionally excluded:

- **No state management** — use `getDb()` + queries
- **No scheduling** — `cron.json` is the scheduling layer
- **No file I/O** — use Node APIs directly
- **No direct handler triggering** — `emit("trigger.<handler-name>")`. Convention: cron auto-subscribes every handler to its `trigger.<name>` event.
- **No agent introspection** — `list/peek/cancel` are LLM tools only, not SDK. Handlers check running sessions via `getDb()` query.
- **No inbox helper** — `getDb()` + SQL query. Common patterns go in shared/lib/.
- **No typed event constants** — emit("handler.completed") is fine. Add constants file later if typos become a problem.

## Patterns: SDK primitives + shared/lib utilities

The SDK is 8 primitives. Common patterns are utilities built on top:

```
agents/shared/lib/
  inbox.ts      — getInbox(db, agent) → unread events
  metrics.ts    — getMetric(db, id) → current value
  projects.ts   — getActiveProjects(db) → project list
```

These are NOT part of the SDK. They're convenience functions that use `getDb()`. Any handler can use them, but they're optional — you can always write raw SQL.

## Migration

No big bang. The binary wraps its internals behind the SDK interface:

1. Define `AgentSDK` in `agents/shared/sdk.d.ts`
2. Binary provides SDK to handlers and workflows (wrapping existing internals)
3. New code uses `ctx.runAgent()`, old code keeps `ctx.manager` (deprecated)
4. Gym runner uses SDK via adapter
5. Gradually migrate, then remove deprecated APIs

## Vision: SDK as system specification

The SDK interface IS the system specification. 7 methods define what the system can do. Everything else — the Bun runtime, SQLite, the event bus, the manager — is implementation detail.

This enables:
- **Formal contract**: anything reachable through the SDK is a supported capability. Anything else is subject to change without notice.
- **Tool generation**: agent tool schemas can be auto-generated from SDK types. One source of truth for both code and LLM interfaces.
- **Runtime portability**: a second runtime (distributed, cloud-based, different language) implements the same 8 methods. Handlers, workflows, and gym scenarios port with zero changes.
- **Testing**: mock the SDK, test everything else in isolation. No integration test needed to verify handler logic.

Today it's a monolithic Bun process with SQLite. Tomorrow it could be anything — as long as it implements AgentSDK.
