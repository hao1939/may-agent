# Multi-Agent Coordination Patterns (2024 Trends)

## Top Frameworks by Stars (GitHub)
1. **MetaGPT** (~67.6k stars): The Multi-Agent Framework: First AI Software Company, Towards Natural Language Programming.
2. **TradingAgents** (~62.1k stars): Multi-Agents LLM Financial Trading Framework.
3. **openai-agents-python** (~25.7k stars): Lightweight framework for multi-agent workflows.
4. **swarm** (~21.4k stars): Educational framework exploring ergonomic, lightweight multi-agent orchestration (OpenAI Solutions).
5. **camel** (~16.8k stars): Early multi-agent framework exploring scaling laws of agents.

## Emerging Architectures (Recent GitHub Activity)
Recent projects focusing on coordination show interesting architectural patterns:
- **Centralized Command/Bus (e.g., ACC)**: Uses a central command center, multimedia bus, and centralized filesystem for coordination among distributed agents.
- **Agent-Native OS (e.g., ProbOS, project-golem)**: Treating the system itself as an OS where components are agents, utilizing OS-level mechanisms (consensus, schedulers) for coordination.
- **Temporal/Synchronized AI (e.g., ChronaOS)**: Using atomic-clock synchronized timing for precise coordination, causal reasoning, and real-world execution.

## Implications for SOUL
- **Lightweight Orchestration**: There is a strong trend (seen in `swarm` and `openai-agents-python`) towards lightweight, ergonomic orchestration rather than heavy enterprise frameworks. Our current heartbeat/metrics model aligns well with this.
- **Centralized vs. Distributed Memory**: Systems like ACC use a centralized filesystem. SOUL uses `.state/may.db` and agent-specific workspaces/knowledge dirs, which is a hybrid approach.
- **Agent-as-OS-Component**: ProbOS explores the OS paradigm. SOUL already structures agents around accountability boundaries (roles) similar to daemon services in an OS.

*(Research conducted during heartbeat)*
