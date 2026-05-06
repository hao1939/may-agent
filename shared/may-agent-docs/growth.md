# Agent Growth

> **Status:** The infra-level growth system (fork/promote/discard API) was removed in v2 cleanup.
> Growth is an **agent-scope concern**, not an infra primitive.

## Philosophy

Agents should be able to evolve their own capabilities — try new approaches, learn from results, improve over time. But the mechanism for this belongs to the agent (via lessons, workflows, tool creation) rather than being a special infra subsystem.

## How Agents Grow (v2)

| Level | Mechanism | Owner |
|-------|-----------|-------|
| Lessons | Write to LESSONS.md | Agent |
| Skills | Create knowledge files | Agent |
| Workflows | Define step sequences | Agent |
| Tools | Create `tools/<name>.ts` | Agent |
| Handlers | Create `handlers/<name>.ts` | Agent |

The infra provides the primitives (file system, event bus, metrics) — agents build growth patterns on top.

## What Was Removed

The old `forkAgent/promoteAgent/discardAgent` API provided infra-level agent sandboxing (`.lab/` directory). This was removed because:

1. It was never used in production
2. Agent experimentation is better handled by the agent itself (branch, test, merge)
3. Infra should provide fundamentals, not opinionated workflows
