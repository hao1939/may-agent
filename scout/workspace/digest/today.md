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
