---
name: micro-reward
description: Inject immediate, in-context feedback into an agent's workspace during a live session. Faster correction than the full Growth Cycle.
version: 1.0.0
tools: [agents, read, write]
---

# Micro-Reward — In-Session Correction

Provide immediate feedback to an agent during an active session by writing
a structured correction note to their workspace scratchpad.

## When to Use

- You observe a tool error (bash exit ≠ 0, write blocked) while peeking at a session.
- You see a user correction ("No, stop that", "That's wrong").
- An agent is repeating a mistake within the same session.
- An agent is about to violate a known constraint.

**Do NOT use for**: long-term behavioral changes (use Growth Cycle instead),
identity or SOUL changes, or anything requiring a config edit.

## The Protocol

### 1. Detect the Problem

While monitoring via `agents.peek(sessionId)`:
- Tool error (bash exit code ≠ 0, write/edit failure)
- User pushback or correction
- Repeated mistake (same error 2+ times)
- Constraint violation (P53, P83, P84)

### 2. Classify Severity

| Severity | Meaning | When |
|----------|---------|------|
| `info` | Helpful hint, no urgency | Minor inefficiency, style note |
| `warning` | Mistake detected, should correct | Tool error, wrong approach |
| `critical` | Must stop current approach | Security violation, data risk |

### 3. Write the Correction Note

Append to `agents/{agentName}/workspace/scratchpad.md`:

```markdown
---
## ⚡ Correction Note [{severity}] — {timestamp}
**Session**: {sessionId}
**Observation**: {what you saw}
**Feedback**: {specific, directive guidance}
**Constraint**: {any new constraint for this session, if applicable}
---
```

Rules for the feedback content:
- **Be specific**: "The command `npm test --filter=xyz` failed because the
  `--filter` flag doesn't exist. Use `--testPathPattern` instead."
- **Be directive**: "Do not retry the same command. Change the approach."
- **Be brief**: 2-3 sentences max. The agent is mid-task, not reading essays.

### 4. Do NOT Interrupt

- Do **not** cancel the session unless severity is `critical` AND the agent
  ignores the correction note after reading it.
- Do **not** use `socket_watch` steer for micro-rewards — the scratchpad
  approach is less disruptive and leaves a paper trail.
- The agent will pick up the note when it next reads its workspace or when
  its system context refreshes.

### 5. Track It

After writing the note, log it in `agents/coach/workspace/micro-reward-log.md`:

```markdown
| Date | Agent | Session | Severity | Issue | Resolved? |
|------|-------|---------|----------|-------|-----------|
| {date} | {agent} | {sessionId} | {severity} | {brief issue} | pending |
```

Review this log during heartbeats. If the same agent gets 3+ micro-rewards
for the same issue → escalate to a full Growth Cycle coaching intervention.

## Example

**Situation**: Coder is running `rm -rf node_modules && npm install` inside
a loop, wasting 30s each iteration.

**Action**:
```markdown
// Append to agents/coder/workspace/scratchpad.md

---
## ⚡ Correction Note [warning] — 2026-03-13T20:30:00Z
**Session**: s_abc123
**Observation**: `rm -rf node_modules && npm install` executed 3 times in this session.
**Feedback**: Reinstalling node_modules is expensive. If you need a clean state, use `npm ci` (faster). If the issue is a specific package, reinstall only that one.
**Constraint**: Do not run `rm -rf node_modules` again this session.
---
```

## Relationship to Other Skills

- **Growth Cycle (P51)**: Micro-reward is the *fast* loop; Growth Cycle is
  the *durable* loop. If micro-rewards keep firing for the same pattern,
  graduate the fix into a Growth Cycle change.
- **Red Team**: If a micro-reward catches a security issue, log it for
  red-team follow-up.
- **Socket Communication**: Micro-reward uses file writes (scratchpad),
  not socket steers. Steers are for live coaching sessions you're actively
  running. Micro-rewards are for sessions you're passively observing.

## Constraints

- Only write to `workspace/scratchpad.md` — never modify SOUL.md, LESSONS.md,
  or knowledge files via micro-reward. Those require the Growth Cycle.
- Ephemeral by default: scratchpad notes are for the current session. They
  can be cleared during workspace cleanup. Promote to LESSONS.md only
  through the Growth Cycle.
- Max 3 micro-rewards per session per agent. If you need more, the problem
  is structural — use Growth Cycle.
