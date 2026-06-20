# Skill: Closing the Loop

## When to Use
After every escalation, notification, or delegation — verify the outcome arrived and was acted on.

## The Problem
Agents send notifications and assume they were received. They create projects and assume progress happens. They escalate and assume resolution. But **unverified communication is not communication**.

## The Pattern

### 1. After you notify another agent
- Note what you sent and to whom
- In your next heartbeat, check: did they act on it?
- If not, re-send or escalate

### 2. After you create a project
- Check the project's journal within 2-3 heartbeats
- Is there progress? If not, flag it
- A project with no journal entries after 3 heartbeats is stalled

### 3. After you escalate
- Track what you escalated and when
- Verify resolution happened
- If no resolution after 2 heartbeats, re-escalate with more context

### 4. After you delegate work
- Check the deliverables directory for output
- Verify the output matches what you asked for
- If quality is low, provide feedback — don't just redo it silently

## How to Track Open Loops

Use `finish()` with `new_items` to create trackable requests:
```
finish({
  new_items: ["Verify amy acted on metric-breach notification from this session"]
})
```

Or check the request DB:
```bash
# See your pending outbound requests
```

## Verification Queries

Check if a notification was acted on:
```bash
# Look for recent sessions by the target agent
bun -e "
// Use query_db tool instead:
// query_db({ sql: "SELECT ..." })
const rows = db.query(\"SELECT session_id, created_at, summary FROM sessions WHERE agent = ? ORDER BY created_at DESC LIMIT 5\").all('<agent-name>');
console.table(rows);
"
```

## Common Mistakes
- **Fire and forget**: Sending a notification and never checking if it was received
- **Assuming projects self-execute**: Projects need agents actively working them
- **Re-doing instead of following up**: If a delegation produced bad output, give feedback rather than silently redoing
- **Not tracking what you sent**: If you can't remember what you escalated, you can't verify it was resolved

## The Rule
**Every outbound action (notify, escalate, delegate, create project) needs a corresponding verification action in a future session.** No exceptions.
