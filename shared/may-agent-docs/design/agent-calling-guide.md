# Agent Calling Guide

## The Rule

**Block by default, async only at the top.**

- **May's chat session** → uses `agents.run()` (async) to stay responsive to the human
- **Everything else** → uses `agents.call()` or `ctx.runAgent()` (blocking)

That's it. No agent inside a workflow or call chain should use async.

## Why

Async (`agents.run`, `agents.send`) decouples the caller from the callee. Good for May (stays responsive), bad for everything else:

- Loses the return value — caller can't use the result
- Requires heartbeat to check completion — 30min latency
- Breaks workflow context chain — sub-steps can't pass data back
- Makes error handling hard — who retries?

Blocking (`agents.call`, `ctx.runAgent`) keeps the chain tight:
- Caller gets the result immediately
- Errors propagate up
- Workflows can branch on results
- No heartbeat waits

## Calling Patterns

### May → delegate (async)
```
agents.run("tech-lead", task)  → returns immediately, May keeps talking
```
May is the ONLY agent that uses async. Because May serves the human.

### Agent → agent (blocking)
```
agents.call("coder", task)     → blocks until coder finishes, gets result
agents.call("qa", review)      → blocks until qa finishes, gets result
```

### Workflow → agent (blocking)
```
ctx.runAgent("coder", task)    → blocks workflow step, gets TaskResult
ctx.runAgent("qa", review)     → blocks workflow step, gets TaskResult
```

### Agent → workflow (blocking)
```
workflow({ action: "run", name: "code-review-loop", task: "..." })
→ blocks agent until workflow completes
```

### Workflow → sub-workflow (blocking)
```
ctx.runWorkflow("two-phase", subtask)  → blocks, gets WorkflowResult
```

### May → workflow (async via agent)
```
agents.run("tech-lead", "workflow code-review-loop\n<task>")
→ tech-lead runs the workflow (blocking for tech-lead)
→ May continues talking to human
```

## What NOT to Do

- ❌ `agents.send()` inside a workflow — adds 30min heartbeat delay
- ❌ `agents.run()` inside a workflow — decouples step, breaks context chain
- ❌ `agents.send()` from agent to agent when result needed — same delay
- ❌ Polling with `agents.peek()` inside a call chain — just use blocking call

## When to Use Each

| Caller | Callee | Pattern | Why |
|--------|--------|---------|-----|
| May (chat) | any agent | `agents.run()` | May must stay responsive |
| May (chat) | workflow via agent | `agents.run("tech-lead", "workflow ...")` | Async + structured loop |
| Agent | agent | `agents.call()` | Get result, decide next step |
| Agent | workflow | `workflow({ action: "run" })` | Structured multi-step |
| Workflow | agent | `ctx.runAgent()` | Fast, synchronous step |
| Workflow | workflow | `ctx.runWorkflow()` | Nested structured loops |

## agents.send() — When?

For truly independent work that doesn't need a result:
- May dispatching a background task she'll check later
- Bob sending a brief for eventual implementation
- Coach scheduling a training experiment

Goes through heartbeat queue (30min delay). Never use when you need the result.
