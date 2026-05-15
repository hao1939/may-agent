# Skill: Escalation

## When to Use
When you're stuck **after real attempts**. Not before trying. Not after one failure.

### Escalate when:
- You've tried 2+ approaches and none worked
- You're blocked by something outside your control (missing API key, permissions, another agent's work)
- You've spent >5 tool calls on the same problem without progress
- The task requires capabilities you don't have

### Don't escalate when:
- You haven't tried anything yet
- The error message tells you exactly what to fix
- You can work around the blocker with a different approach

## How to Escalate

### 1. Use `finish(status='blocked')` with full context

```
finish({
  status: 'blocked',
  summary: 'Cannot proceed with X because Y',
  blockers: [{
    reason: 'What is blocking you',
    context: 'What you tried, why it failed, what you need'
  }],
  next_steps: 'What should happen to unblock this'
})
```

### 2. What to include in context
- **What you were trying to do** (the goal, not just the step)
- **What you tried** (specific commands, approaches — not "I tried several things")
- **What happened** (error messages, unexpected results)
- **What you think is needed** (access, fix, different approach)

### 3. If another agent is blocking you
Use `notify` to tell them what you need:
```
notify({
  agent: '<blocking-agent>',
  message: 'I need X from your project Y. Context: ...',
  priority: 'P1'
})
```

## The Escalation Chain
1. **Self-fix**: Try 2+ approaches
2. **Peer help**: Notify the relevant agent
3. **Blocked finish**: `finish(status='blocked')` with full context
4. **P0 escalation**: For urgent blockers, use `priority: 'P0'` in notifications

## Common Mistakes
- **"I'm blocked"** with no context → Nobody can help you
- **Escalating too early** → Try harder first
- **Escalating too late** → 10 tool calls into a dead end is waste. Escalate at 5.
- **Not saying what you need** → "I'm blocked on X" vs "I need Y to unblock X"
