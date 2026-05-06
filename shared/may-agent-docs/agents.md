# Agent Cooperation

## Three Calling Patterns

| Action | Behavior | When to use |
|--------|----------|-------------|
| `call` | Sync — blocks, returns result | Need the result to continue |
| `fork` | Async — returns immediately | Parallel work, stay responsive |
| `message` | Fire-and-forget — inbox pickup | Background, not time-sensitive |

## SDK Equivalents

```typescript
// call (sync — blocks until child finishes)
const result = await sdk.runAgent("tech-lead", task);

// fork (async — starts independent session, returns immediately)
// Note: fork creates a new root session with originSessionId link back.
// From handler code, use sdk.runAgent without await:
sdk.runAgent("tech-lead", task);  // don't await = fire-and-forget

// message (async notification — delivered at next heartbeat)
sdk.notify("bob", "Review this design");
// emits: { type: "message.created", from: agent, to: "bob", content: "..." }
```

## Session Tree

```
call creates children under the same root:

  Root (May heartbeat)
    ├── call("tech-lead", task)         ← child (blocks)
    │     └── call("coder", task)       ← grandchild
    └── call("qa", review)              ← child

fork creates a new root:

  Root A → fork("tech-lead", big-task)  ← returns sessionId
  Root B (independent tree)
    └── call("coder", subtask)
```

## Context Passing

- **call:** child sees parent's task + context. Result flows back.
- **fork:** new root, carries `originSessionId` link. Read-only access to origin.
- **message:** no session until picked up. Agent sees it in heartbeat inbox.

## When to Use What

| Situation | Pattern |
|-----------|---------|
| Need answer before continuing | `call` |
| Dispatch work, don't wait | `fork` |
| FYI notification | `message` (notify) |
| Multiple agents in parallel | `Promise.all([sdk.runAgent(...), ...])` |
| Background task | `fork` + check session status later |

## Result Structure

```typescript
interface TaskResult {
  sessionId: string;
  status: string;          // "done" | "error" | "blocked"
  lastAssistantText: string;
}
```

## Implementation

- **Agent tool:** `src/lib/manager-agents-tool.ts` (LLM-facing)
- **SDK:** `src/lib/sdk-impl.ts` → `runAgent()` wraps `manager.callAgent()`
- **Manager:** `src/lib/manager.ts` — session lifecycle
