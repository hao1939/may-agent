# may-agent Documentation

## Design (What We're Building)

See [design/INDEX.md](design/INDEX.md) for the full index.

Key docs:
- [Architecture Redesign](design/architecture-redesign.md) — EventBus, components, event types
- [Agent Calling Guide](design/agent-calling-guide.md) — call/fork/message + context queries
- [Research System](design/research-system.md) — adversarial peers, lab, knowledge base
- [Evidence-First Process](design/evidence-first-process.md) — how to validate ideas

## Architecture (How It Works)

- [Session Model](architecture/session-model.md) — Chat/Task, session kinds (chat/job/call)
- [Session State Machine](architecture/session-state-machine.md) — Status transitions, handleCompletion
- [System Prompt](architecture/system-prompt.md) — SOUL.md + common-sense.md + generated
- [Socket Protocol](architecture/socket-protocol.md) — Unix socket, JSON-line commands
- [Event Loop](architecture/event-loop.md) — How sessions run concurrently
- [LLM Call Structure](architecture/llm-call-structure.md) — Provider → streaming → tool calls
- [Cron System](architecture/cron-system.md) — Heartbeats, handlers, scheduling

## Manual (How to Use)

- [User Guide](manual/user-guide.md) — CLI flags, Docker, socket
- [Agent Convention](manual/agent-convention.md) — Directory layout, SOUL.md, agent.json

## Knowledge Base

- [Knowledge Entries](../../knowledge/entries/) — Verified facts with evidence
- [Hypotheses](../../knowledge/hypotheses/) — Testable claims
- [Experiments](../../knowledge/experiments/) — Lab results

## Archive

Historical docs in `archive/`. Pre-pivot designs, completed work, failed experiments.
