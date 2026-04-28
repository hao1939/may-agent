# Design: Agent SDK & Gym Runner

**Status**: draft
**Date**: 2026-04-28

## Problem

Three separate "SDKs" exist with overlapping capabilities:
- **RuntimeCtx**: emit, getDb, log, notify, paths (shared infra)
- **HandlerContext**: RuntimeCtx + manager, triggerNow (for handlers)
- **WorkflowContext**: RuntimeCtx + runAgent, createSession, done/escalate (for workflows)

The gym runner needs to run agents and score results but can't import from src/ (compiled into binary). It currently lives in test/ (inaccessible to container agents).

## Insight: One SDK, Different Capabilities

All three contexts do the same thing at different levels:

| Capability | RuntimeCtx | HandlerCtx | WorkflowCtx | Gym needs it? |
|-----------|-----------|-----------|-----------|-------------|
| emit events | ✅ | ✅ | ✅ | ✅ |
| read DB | ✅ | ✅ | ✅ | ✅ |
| log | ✅ | ✅ | ✅ | ✅ |
| run agent session | ❌ | ✅ (manager) | ✅ (runAgent) | ✅ |
| create persistent session | ❌ | ❌ | ✅ (createSession) | maybe |
| trigger cron | ❌ | ✅ | ❌ | ❌ |
| done/escalate | ❌ | ❌ | ✅ | ❌ |

The gym runner needs: **run agent + read DB + emit events**. That's RuntimeCtx + `runAgent()`.

## Design: Unified SDK

```typescript
// agents/shared/sdk.ts — the agent SDK

interface AgentSDK {
  // Infra (from RuntimeCtx)
  emit(event: { type: string; [key: string]: unknown }): void;
  getDb(): SqliteDb;
  log(msg: string): void;
  notify(msg: string): void;
  
  // Paths
  persistDir: string;
  projectRoot: string;
  agentsRoot: string;
  
  // Agent execution
  runAgent(agent: string, task: string, opts?: RunAgentOpts): Promise<TaskResult>;
  createSession(opts: SessionOpts): Promise<SessionHandle>;
}

interface RunAgentOpts {
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
```

## Who provides the SDK?

The binary provides the real implementation. It's injected into:
- **Handlers** via HandlerContext (already has manager)
- **Workflows** via WorkflowContext (already has runAgent/createSession)
- **Gym runner** via a new entry point

```
Binary (infra)
  ├── builds AgentSDK from manager + bus + db
  ├── injects into HandlerContext
  ├── injects into WorkflowContext  
  └── exposes via CLI: may-agent --sdk-server (for gym)
```

## Gym Runner Architecture

```
agents/gym/
  runner.ts          — imports AgentSDK, runs scenarios
  scenarios/         — test cases
  adapters/
    live.ts          — uses real AgentSDK (calls binary via CLI or socket)
    stub.ts          — returns canned responses (no LLM, fast)
    record.ts        — records real responses for replay
```

The runner doesn't import from src/. It uses the SDK interface. The adapter determines whether it talks to the real system or a mock.

## How gym runs inside the container

Option A: **CLI adapter** — runner calls `may-agent --run-task <agent> <task>` via exec
Option B: **Socket adapter** — runner connects to the running may-agent socket
Option C: **Direct import** — runner imports AgentSDK from a bundled module

Option B is cleanest — the socket already exists for the web UI. Add a `run-agent` command to the socket protocol.

## Unification path

1. Define `AgentSDK` interface in `agents/shared/sdk.ts`
2. Binary implements it, exposes via socket
3. Refactor WorkflowContext to use AgentSDK (runAgent/createSession come from SDK)
4. Refactor HandlerContext to use AgentSDK (manager.callAgent → sdk.runAgent)
5. Gym runner imports AgentSDK interface, uses socket adapter in container
6. Move gym runner from test/ to agents/gym/

## What NOT to change now
- RuntimeCtx stays as-is (it's the infra layer inside the binary)
- Existing workflows keep working (WorkflowContext wraps AgentSDK)
- No breaking changes to handler API
