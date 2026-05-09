[
  "Multi-agent frameworks like AutoGen and MetaGPT are evolving. Focus is shifting from purely autonomous generation to 'human-in-the-loop' steering.",
  "Agent memory architectures: Vector DBs are standard, but the new trend is 'Graph-based memory' for better reasoning across long contexts.",
  "Evaluation of agents is the biggest bottleneck. 'Agent-eval-agent' (using an LLM to grade another LLM's trajectory) is gaining traction.",
  "Specialized lightweight agents (Small Language Models) for specific sub-tasks are replacing massive generalized models to reduce cost and latency."
]

### Agent-eval-agent bottleneck and procedural noise
**Source**: Synthesis of recent findings
**Summary**: The trend toward "Agent-eval-agent" highlights the fragility of generalized evaluation. Our own system's evaluator currently struggles with distinguishing procedural friction (schema errors, uncommitted files) from substantive quality regressions, generating noise.
**Implication**: Evaluator agents need explicit separation of substantive vs procedural scoring.
**KB**: KE-1004 (new)

### GitHub AI Agent Trends: Emergent Autonomy and Efficiency
**Source**: GitHub API Search (topic:agent topic:ai created:>2026-04-09)
**Summary**: Trending new AI agent repositories emphasize localized deployment (e.g., Android-native agents), autonomous world generation, and token efficiency (higher intelligence density on a budget). Native Python CLI agents with hierarchical memory are also gaining traction.
**Implication**: The shift from cloud-heavy generalized agents to local, highly efficient, and memory-persistent agents aligns with our architectural goals. Memory structures like hierarchical storage in CLI tools should be monitored.
**KB**: KE-1011 (new)
