# Agent Cooperation

## Calling Patterns

| Action | Behavior | When to use |
|--------|----------|-------------|
| `call` | Sync — blocks, returns result | Need the result to continue |
| `message` | Fire-and-forget — inbox pickup | Background, not time-sensitive |

## SDK And Handler Equivalents

```typescript
// call (sync — blocks until child finishes)
const result = await sdk.runAgent("tech-lead", task);

// parallel calls
const [coder, qa] = await Promise.all([
  sdk.runAgent("coder", task),
  sdk.runAgent("qa", review),
]);

// message (async notification — delivered at next heartbeat)
sdk.message("bob", "Review this design");
// emits: { type: "message.created", from: agent, to: "bob", content: "..." }
```

## Session Tree

```
call creates children under the same root:

  Root (May heartbeat)
    ├── call("tech-lead", task)         ← child (blocks)
    │     └── call("coder", task)       ← grandchild
    └── call("qa", review)             ← child
```

## Context Passing

- **call:** child sees parent's task + context. Result flows back.
- **message:** no session until picked up. Agent sees it in heartbeat inbox.

## When to Use What

| Situation | Pattern |
|-----------|---------|
| Need answer before continuing | `sdk.runAgent()` |
| Multiple agents in parallel | `Promise.all([sdk.runAgent(...), ...])` |
| FYI notification | `sdk.message()` |
| Run a multi-step flow | `sdk.runWorkflow()` |

## Result Structure

```typescript
interface TaskResult {
  sessionId: string;
  status: string;          // "done" | "error" | "interrupted"
  lastAssistantText: string;
}
```

## Implementation

- **Agent tool:** `src/lib/manager-agents-tool.ts` (LLM-facing)
- **SDK:** `src/lib/sdk-impl.ts` → `runAgent()` wraps `manager.callAgent()`
- **Manager:** `src/lib/manager.ts` — session lifecycle
