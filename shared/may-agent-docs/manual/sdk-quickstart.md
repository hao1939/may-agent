# SDK Quick Reference

The AgentSDK is available to all handlers via `ctx.sdk`. See
[sdk.md](../design/sdk.md) for the full interface.

## Run an Agent

```typescript
const result = await sdk.runAgent("tech-lead", "Review this PR");
// result.status, result.lastAssistantText, result.sessionId

const [coder, qa] = await Promise.all([
  sdk.runAgent("coder", "Implement the fix"),
  sdk.runAgent("qa", "Review the fix"),
]);
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

## Message

```typescript
sdk.message("human", "Deploy complete");     // → Telegram/web
sdk.message("bob", "Your PR was merged");    // → bob's inbox
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
sdk.message("bob", "Check the failing tests");
// emits: { type: "message.created", from: agent, to: "bob", content: "..." }
```

### Trigger another handler
```typescript
sdk.emit("trigger.metrics-snapshot", {});  // convention: trigger.<handler-name>
```
