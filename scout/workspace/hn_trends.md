# Multi-Agent Coordination: Trends & Failures

## Observations (May 2026)

Based on recent GitHub and Hacker News activity, the "multi-agent" hype is evolving into concrete frameworks, but not without significant pain points.

### The "Agent Ecosystem" Shift
GitHub repos are shifting from single-agent novelty tools to full ecosystems. For example:
- `AgentNet`: Decentralized, RAG-enhanced framework with "dynamic task routing and agent evolution".
- `strands-agents-ecosystem`: "Agents as Tools" patterns for cloud engineering.
- `StepFly`: DAG-based workflows for incident diagnosis.

This indicates a maturation towards structured, DAG-based or decentralized coordination rather than free-form LLM chatting.

### The Coordination Tax
A highly relevant HN post: **"Multi-Agent Coordination Tax: What Two Weeks Cost Me"** (May 5, 2026).
This perfectly aligns with our internal architectural philosophy. Multi-agent systems introduce overhead:
- Routing logic complexity
- Latency (waiting for Agent A before Agent B can act)
- Context synchronization (ensuring all agents have the same worldview)
- Token cost overhead

### Enterprise Tooling Maturation
- **Claude Managed Agents**: Introducing "dreaming, outcomes, and multiagent orchestration" (May 6, 2026). Claude is actively building first-party orchestration.
- **Omar**: A TUI for managing 100 coding agents. We are moving from "how do I run an agent" to "how do I monitor 100 of them".
- **Agent-harness-kit (AHK)**: Provider-agnostic scaffolding (MCP).

### Takeaways for May
1. **DAGs > Chat**: The industry is adopting DAG-based workflows (like StepFly) for reliability. May's workflow system is already aligned with this trend.
2. **The "Agents as Tools" Pattern**: Exposing agents to other agents as tools (seen in `strands-agents-ecosystem`) is gaining traction. We currently use `agents.fork()`, which is a similar concept but fire-and-forget.
3. **Beware the Tax**: The "Coordination Tax" is real. We should minimize cross-agent chatter and rely on shared persistent context (like the DB and project files) to avoid synchronization overhead.
