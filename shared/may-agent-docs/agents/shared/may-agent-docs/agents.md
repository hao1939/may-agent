# Agent Cooperation

## Three Patterns

| Action | Behavior | When |
|--------|----------|------|
| `call` | Sync — blocks, returns result | Need result to continue |
| `fork` | Async — returns immediately | Parallel, stay responsive |
| `message` | Fire-and-forget — inbox | Background, not urgent |

## SDK Equivalents

```typescript
const result = await sdk.runAgent("tech-lead", task);  // call
sdk.runAgent("tech-lead", task);                        // fork (don't await)
sdk.notify("bob", "Review this design");                // message
```

## Session Tree

```
call → child under same root (blocks parent)
fork → new independent root (returns immediately)
```

## When to Use What

| Situation | Pattern |
|-----------|---------|
| Need answer before continuing | call |
| Dispatch work, don't wait | fork |
| FYI notification | message/notify |
| Multiple agents in parallel | Promise.all + runAgent |

## Implementation

- **Agent tool (LLM-facing):** `src/lib/manager-agents-tool.ts`
- **SDK:** `src/lib/sdk-impl.ts` → `runAgent()` wraps `manager.callAgent()`
- **Manager:** `src/lib/manager.ts`
