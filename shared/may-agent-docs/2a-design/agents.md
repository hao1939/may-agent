# Agent Cooperation

## Calling Patterns

| Action | Behavior | When to use |
|--------|----------|-------------|
| `call` | Sync — blocks, returns result | Need the result to continue |
| `fork` | Async — returns sessionId, you continue | Background work, don't need result now |
| `message` | Fire-and-forget — inbox pickup | FYI notification, not time-sensitive |

## SDK And Handler Equivalents

```typescript
// call (sync — blocks until child finishes)
const result = await sdk.runAgent("tech-lead", task);

// parallel calls
const [dev, qa] = await Promise.all([
  sdk.runAgent("dev", task),
  sdk.runAgent("qa", review),
]);

// message (async notification — delivered at next heartbeat)
sdk.message("bob", "Review this design");
// emits canonical message.created with owner: "agent:bob"
// and data: { from: agent, to: "bob", content: "...", priority: "P2" }
```

## Session Tree

```
call creates children; fork creates independent sessions:

  Root (May heartbeat)
    ├── call("tech-lead", task)         ← child (blocks)
    │     └── call("dev", task)         ← grandchild
    ├── call("qa", review)             ← child
    └── fork("scout", task)            ← independent (non-blocking)
```

## Context Passing

- **call:** child sees parent's task + context. Result flows back.
- **message:** no session until picked up. Agent sees it in heartbeat inbox.

## When to Use What

| Situation | Pattern |
|-----------|---------|
| Need answer before continuing | `call` (or `sdk.runAgent()`) |
| Multiple agents in parallel | `Promise.all([sdk.runAgent(...), ...])` |
| Background work, check later | `fork` (agents tool only, no SDK wrapper) |
| FYI notification | `message` (or `sdk.message()`) |
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

- **Agent tool:** `src/lib/manager-agents-tool.ts` (LLM-facing)
- **SDK:** `src/lib/sdk-impl.ts` → `runAgent()` wraps `manager.callAgent()`
- **Manager:** `src/lib/manager.ts` — session lifecycle
