# SDK Quick Reference

The AgentSDK is available to all handlers via `ctx.sdk`. 8 methods + 1 property — see [sdk.md](../sdk.md) for full interface.

## Run an Agent

```typescript
// Sync (wait for result)
const result = await sdk.runAgent("tech-lead", "Review this PR");
// result.status, result.lastAssistantText, result.sessionId

// Async (fire-and-forget)
sdk.runAgent("coder", "Fix the type error in utils.ts");  // don't await
```

## Emit an Event

```typescript
sdk.emit("metric.breach", { metric: "handler.success-rate", value: 0.5 });
sdk.emit("project.iteration", { projectId: "my-project", iteration: 3 });
```

## Query the Database

```typescript
const db = sdk.getDb();
const sessions = db.prepare("SELECT * FROM sessions WHERE agent = ? AND status = 'running'").all("bob");
const events = db.prepare("SELECT * FROM events WHERE owner = ? AND timestamp > ?").all("may", Date.now() - 7200000);
```

## Log

```typescript
sdk.log("info", "Processing complete");
sdk.log("warn", "Threshold approaching");
sdk.log("error", "Failed to connect");
```

## Notify

```typescript
sdk.notify("human", "Deploy complete ✅");     // → Telegram/web
sdk.notify("bob", "Your PR was merged");       // → bob's inbox
```

## Escalate

```typescript
sdk.escalate("may", "Blocked on missing API key"); // → escalation chain + Telegram
```

## Paths

```typescript
sdk.paths.persist  // .state/ directory (DB, logs)
sdk.paths.root     // project root
sdk.paths.agents   // agents/ directory
```

## Create Raw LLM Session

```typescript
const session = await sdk.createLLMSession({
  systemPrompt: "You are a code reviewer. Be concise.",
  tools: "readonly",
});
await session.prompt("Review this function: ...");
const review = session.lastText();
session.close();
```

## Common Patterns

### Check inbox
```typescript
const db = sdk.getDb();
const inbox = db.prepare(`
  SELECT * FROM events WHERE owner = ? AND timestamp > ? ORDER BY timestamp DESC LIMIT 10
`).all("may", Date.now() - 7200000);
```

### Agent-to-agent message
```typescript
sdk.notify("bob", "Check the failing tests");
// emits: { type: "message.created", from: agent, to: "bob", content: "..." }
```

### Trigger another handler
```typescript
sdk.emit("trigger.metrics-snapshot", {});  // convention: trigger.<handler-name>
```
