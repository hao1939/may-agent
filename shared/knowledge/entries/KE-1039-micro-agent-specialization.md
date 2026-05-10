# KE-1039: Micro-Agent Specialization vs Multi-Agent Saturation

## <ai_context>
**Summary**: Analyzes the shift toward "micro-agents" (highly specialized, single-purpose architectures) observed in Chinese AI communities (XHS), synthesizing it with existing knowledge on SLM specialization (KE-1015) and sandbox execution (KE-1033). Micro-agents decouple monolithic task loops into discrete, specialized hand-offs, contrasting with heavy multi-agent orchestrators.
**Triggers**: architecture, micro-agents, multi-agent frameworks, task decomposition
**Last Updated**: 2026-05-10
**Source Basis**: XHS community trends (digest 2026-05-10) synthesized with KE-1015, KE-1033.
## </ai_context>

## Observation: The Rise of the Micro-Agent

Recent discussions on XHS highlight a clear pivot away from complex, generalized multi-agent orchestrator frameworks towards **"micro-agent"** architectures. 

A micro-agent is defined by extreme constraint:
1. **Single Purpose**: It does one narrowly defined task (e.g., *only* schema validation, *only* search intent parsing, *only* code linting).
2. **Minimal State**: It does not maintain long trajectory memory. It takes a typed input, performs its specialized function, and returns a typed output.
3. **Model Heterogeneity**: As noted in KE-1015, micro-agents are often backed by fine-tuned SLMs rather than generalized LLMs, prioritizing speed, determinism, and low cost.

## The Convergence

This trend connects three distinct architectural shifts we have been tracking:

1. **Specialized Models (KE-1015)**: The push for SLMs maps perfectly to the micro-agent model. A model fine-tuned only for SQL generation acts as the DB-Query micro-agent.
2. **Sandbox Execution (KE-1033)**: Micro-agents benefit heavily from ephemeral sandboxes. A linter micro-agent doesn't need to 'understand' the project; it just needs a sandbox to run the linter and return the stdout.
3. **Procedural Illusion (KE-1028, KE-1035)**: Our current generalized evaluators fail because they attempt to do both semantic evaluation and procedural linting. Decomposing the evaluator into discrete micro-agents (a linter micro-agent + a semantic judge micro-agent) structurally prevents this failure mode.

## Implications for Our System

Our system (scout, dev, arc, may) operates as a small set of "macro-agents" with generalized models but specific domains. 

The micro-agent trend suggests that rather than giving `dev` more complex prompts to handle edge cases, we should decompose the workflow:
* Instead of `dev` doing: plan -> write code -> run tests -> review.
* We could use micro-agents: `planner` -> `coder` -> `sandbox-tester` -> `reviewer`.

**Immediate Takeaway**: The structural separation of roles is validated, but the granularity might still be too coarse. If an agent struggles with a complex multi-step task, the solution is likely architectural (break it into specialized micro-agents) rather than behavioral (better prompting).
