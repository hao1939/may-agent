# may-agent Documentation

## Start Here

- [common-sense.md](../common-sense.md) — How agents think and work. The foundation.
- [Design Index](design/INDEX.md) — All active design documents, organized by topic.

## Architecture (How It Works)

How the runtime operates. Read when you need to understand internals.

- [Session Model](architecture/session-model.md) — Chat/Task sessions, session kinds
- [Session State Machine](architecture/session-state-machine.md) — Status transitions
- [System Prompt](architecture/system-prompt.md) — SOUL.md + common-sense.md + generated
- [Cron System](architecture/cron-system.md) — Heartbeats, handlers, scheduling
- [Event Loop](architecture/event-loop.md) — How sessions run concurrently
- [LLM Call Structure](architecture/llm-call-structure.md) — Provider → streaming → tool calls
- [Socket Protocol](architecture/socket-protocol.md) — Unix socket, JSON-line commands

## Design (What We're Building)

Active design decisions. Read when you need to understand WHY something works a certain way.

**Core:**
- [Context Injection](design/context-injection-design.md) — What agents see in their prompt
- [Persistent Task](design/persistent-task-files.md) — Project system with evaluator gate
- [Metrics System](design/metrics-system.md) — Per-agent metrics, alerts, dashboard

**Agent behavior:**
- [Agent Calling Guide](design/agent-calling-guide.md) — call/fork/message patterns
- [Evidence-First Process](design/evidence-first-process.md) — Validate before building
- [Context Learning](design/context-learning.md) — A/B proof that context changes behavior

See [design/INDEX.md](design/INDEX.md) for the full list.

## Manual (How to Use)

- [User Guide](manual/user-guide.md) — CLI flags, Docker, socket
- [Agent Convention](manual/agent-convention.md) — Directory layout, SOUL.md, agent.json
