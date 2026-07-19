# SDK Quick Reference

The AgentSDK is available to all handlers via `ctx.sdk`. See
[sdk.md](../2a-design/sdk.md) for the full interface.

## Choose the Right Primitive

| Scenario | Use |
|----------|-----|
| Need an agent's answer now | `sdk.runAgent(...)` |
| Need a multi-step recipe with retries/verification | `sdk.runWorkflow(...)` |
| Need to publish a fact other infra can react to | `sdk.emit(type, data, envelope)` |
| Need async communication to an agent or human | `sdk.message(target, content)` |
| Need to route a blocker outside the current owner | `sdk.escalate(reason, opts)` |
| Need runtime facts for preflight | `sdk.query` first, `sdk.getDb()` only as escape hatch |

## Run an Agent

```typescript
const result = await sdk.runAgent("tech-lead", "Review this PR");
// result.status, result.lastAssistantText, result.sessionId

const [dev, qa] = await Promise.all([
  sdk.runAgent("dev", "Implement the fix"),
  sdk.runAgent("qa", "Review the fix"),
]);
```

## Emit an Event

Use events for durable facts: metric breaches, project task lifecycle, handler
decisions, recovery attempts, and similar things that other handlers or the UI
may query later. Put routing metadata in the envelope argument and domain
context in `data`.

```typescript
sdk.emit("metric.breach", {
  metricId: "handler.success-rate",
  metricName: "Handler success rate",
  current: 0.5,
  threshold: 0.8,
  target: 0.95,
  message: "Handler success rate is below threshold.",
  priority: "P1",
}, { owner: "agent:may", source: "metrics-snapshot", urgency: "high" });

sdk.emit("platform.change.observed", {
  project: "platform",
  subject: "release-validation",
  state: "passed",
  evidence: ["Tests are green."],
}, { owner: "agent:may", source: "release-watcher" });
```

Do not put `owner` or `source` inside `data` for canonical events. Use the
envelope argument so persistence and routing can see those fields consistently.

## Query Runtime Facts

Prefer `sdk.query` for common preflight reads because it keeps handlers stable
when database tables evolve. Use `sdk.getDb()` only when the query facade does
not cover the needed read yet.

```typescript
const alerts = sdk.query.alerts({ resolved: false, limit: 10 });
const context = sdk.query.metricAlertContext({ metricId: "handler.success-rate" });
```

Compatibility escape hatch:

```typescript
const db = sdk.getDb();
const sessions = db.prepare("SELECT * FROM sessions WHERE agent = ? AND status = 'running'").all("bob");
const events = db.prepare("SELECT * FROM events WHERE owner = ? AND timestamp > ?").all("agent:may", Date.now() - 7200000);
```

## Log

```typescript
sdk.log("info", "Processing complete");
sdk.log("warn", "Threshold approaching");
sdk.log("error", "Failed to connect");
```

## Message

Use messages for async communication. Messages are not proof that work was done;
they create inbox context for the target.

```typescript
sdk.message("human", "Deploy complete");     // → Telegram/web
sdk.message("bob", "Your PR was merged");    // → bob's inbox as owner agent:bob
```

## External Escalate

Use `sdk.escalate(...)` from handlers or agent-side SDK code when the blocker
must be routed outside the current owner. Workflow `ctx.blocked(...)` is a
local terminal workflow result; it does not emit this event by itself.

For human routing, set `owner: "human:<role>"`. May is the human's deputy for
delivery, but the owner remains the human role.

```typescript
sdk.escalate("Blocked on missing API key"); // defaults to owner: "agent:may"

sdk.escalate("Missing production decision", {
  owner: "human:operator",
  requestedAction: "Choose whether to deploy now or wait for the next window.",
  severity: "P1",
});
```

Typical escalation choices:

| Situation | Use |
|-----------|-----|
| The current handler/agent is blocked and May should route or resolve | `sdk.escalate(reason)` |
| A human decision is required | `sdk.escalate(reason, { owner: "human:<role>", requestedAction, evidence })` |
| A workflow hit a local blocker | Return `ctx.blocked(...)`; let the caller decide whether to promote it |
| The owner has resolved an escalation | Emit `escalation.resolved` with `outcome`, `summary`, and optional `resumeInstruction` |

When a terminal `escalation.resolved` event matches an earlier
`escalation.created` with `sourceSessionId`, runtime sends the resolution back
to the active source session or cold-resumes that session. If the escalation also
has `workflowRunId` or project context, that context is passed to the resumed
task; workflow and project records are not resumed directly by escalation
lifecycle. `needs_human` is the exception: it waits for the linked human child
escalation to resolve.

## Paths

```typescript
sdk.paths.persist  // .state/ directory (DB, logs)
sdk.paths.root     // project root
sdk.paths.agents   // agents/ directory
```

## Common Patterns

### Check inbox
```typescript
const inbox = sdk.query.events({
  owner: "agent:may",
  since: Date.now() - 7200000,
  limit: 10,
});
```

### Agent-to-agent message
```typescript
sdk.message("bob", "Check the failing tests");
// emits canonical message.created with owner: "agent:bob"
// and data: { from: agent, to: "bob", content: "...", priority: "P2" }
```

### Trigger another handler from handler code
```typescript
ctx.triggerNow("metrics-snapshot");
```

`trigger.<entry-name>` is an operator/control shortcut for a trigger entry, not a
domain lifecycle event. Use `ctx.triggerNow(...)` inside handlers instead of
publishing `trigger.*` through `sdk.emit(...)`.
