# Multi-Agent Recent Developments

## Recent Hacker News Trends (Latest)
- **Claude Managed Agents** announced features around "dreaming, outcomes, and multiagent orchestration" (Feb 2025). This shows orchestration being pushed into the platform layer.
- **Infinite you**: A multi-agent workflow system.
- **Agent-harness-kit (AHK)**: Scaffolding for multi-agent workflows (MCP, provider-agnostic).
- **Herd**: A lightweight multi-agent IDE.

## Historical Milestones
- AlphaStar (DeepMind) using multi-agent RL for StarCraft II.
- Emergent Tool Use from Multi-Agent Interaction (OpenAI).
- Fable Studio's SHOW-1 and Showrunner Agents for simulations.

## Implications for Our Architecture
- Managed coordination: We use file-based handoffs and db-backed state. We should monitor how MCP (Model Context Protocol) is evolving for inter-agent communication, as tools like AHK are standardizing around it.
- Autonomy: "Dreaming" (as referenced by Claude) aligns with our heartbeat/gym mechanisms where agents self-direct work during idle time.
