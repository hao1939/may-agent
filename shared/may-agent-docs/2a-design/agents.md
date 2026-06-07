# Agent Cooperation

## Calling Patterns

There are two tool surfaces: the `agents` tool (for session management) and the
separate `message` tool (for async inter-agent communication). The old
`agents.message` / `agents.send` actions were removed in commit d15c5249 and
return a deprecation error.

### agents tool actions

| Action | Behavior | When to use |
|--------|----------|-------------|
| `call` | Sync — blocks, returns result | Need the result to continue |
| `fork` | Async — returns sessionId, you continue | Background work, don't need result now |
| `list` | Returns registered agents and running sessions | Discovery |
| `peek` | View recent messages from a running session | Monitor a forked session |
| `cancel` | Cancel a running session | Abort background work |
| `context` | Read/update agent context | Context management |
| `requests` | Query the request tracking DB | Check request status |

### message tool

| Action | Behavior | When to use |
|--------|----------|-------------|
| `message({ to, content })` | Fire-and-forget — queued for receiver's next heartbeat | FYI notification, not time-sensitive |

## SDK And Handler Equivalents

```typescript
// call (sync — blocks until child finishes)
const result = await sdk.runAgent("tech-lead", task);

// parallel calls
const [devResult, scoutResult] = await Promise.all([
  sdk.runAgent("dev", task),
  sdk.runAgent("scout", review),
]);

// message (async notification — delivered at next heartbeat)
sdk.message("arc", "Review this design");
// emits canonical message.created with owner: "agent:arc"
// and data: { from: agent, to: "arc", content: "...", priority: "P2" }
```

## Session Tree

```
call creates children; fork creates independent sessions:

  Root (May heartbeat)
    ├── call("tech-lead", task)         ← child (blocks)
    │     └── call("dev", task)         ← grandchild
    ├── call("scout", review)          ← child
    └── fork("evaluator", task)        ← independent (non-blocking)
```

## Context Passing

- **call:** child sees parent's task + context. Result flows back.
- **message (tool):** no session until picked up. Agent sees it in heartbeat inbox.

## When to Use What

| Situation | Pattern |
|-----------|---------|
| Need answer before continuing | `call` (or `sdk.runAgent()`) |
| Multiple agents in parallel | `Promise.all([sdk.runAgent(...), ...])` |
| Background work, check later | `fork` (agents tool) |
| FYI notification | `message` tool (or `sdk.message()`) |
| Run a multi-step flow | `sdk.runWorkflow()` |

## Result Structure

```typescript
interface TaskResult {
  sessionId: string;
  status: string;          // commonly "done", "error", or "interrupted"; not a closed enum today
  lastAssistantText: string;
}
```

## Implementation

- **Agent tool:** `src/lib/manager-agents-tool.ts` (LLM-facing; actions: call, fork, list, peek, cancel, context, requests)
- **Message tool:** `src/lib/tools/message-tool.ts` (async inter-agent messaging; replaces old agents.message action)
- **SDK:** `src/lib/sdk-impl.ts` → `runAgent()` wraps `manager.callAgent()`
- **Manager:** `src/lib/manager.ts` — session lifecycle
