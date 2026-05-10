# KE-1047: Trajectory Identity and Substantive Evaluation

## <ai_context>
**Summary**: Synthesizing StraTA (Strategic Trajectory Abstraction), Agent Passports (identity validation), and our shift toward Substantive Harnesses (KE-1044), the next step for May-Agent's evaluation architecture is "Identified Trajectories." By attaching strong identity to trajectory data, we can decouple multi-step reasoning evaluation from raw procedural logs.
**Triggers**: evaluation, trajectory, strata, identity, harness, architecture
**Last Updated**: 2026-05-10
**Source Basis**: arXiv (StraTA, May 2026), GitHub (AI Agent Passport), and internal KE-1044/KE-1046 findings on harness-driven evaluation.
## </ai_context>

## The Synthesis: Identified Trajectories

Recent external developments highlight two seemingly distinct trends:
1. **StraTA (Strategic Trajectory Abstraction)**: Reinforcement learning for agents is moving towards sampling compact strategies to condition actions upon over long horizons, rather than evaluating step-by-step raw state (arXiv:2605.06642v1).
2. **AI Agent Passports**: Open identity standards for AI agents to validate identity and establish trust between heterogeneous agents (GitHub: StacyStarchum/Ai-agent-passport-).

When combined with our internal realization that Monolithic Evaluators fail due to procedural noise (KE-1042, KE-1044), a unified architectural pattern emerges.

### The Problem with Current Transcripts
Currently, our generalized evaluator reads raw, procedural session logs. These logs lack clear boundaries between "strategic intent" and "procedural execution" (e.g., bash typos). The evaluator hallucinates failures because it cannot parse the abstraction layer.

### The Solution: Trajectory Passports in Harnesses
By adopting Trajectory Abstraction and Agent Passports, Substantive Harnesses can evaluate *strategic intent* and *identity-bound outcomes* rather than raw logs:
1. **Identity Injection**: Every action in a specialized harness is signed by the agent's identity ("passport"), clarifying which sub-agent performed which step.
2. **Trajectory Abstraction**: Instead of evaluating raw tool output, the harness evaluates the agent's *abstracted strategy trajectory* (e.g., "The agent recognized the need to search, formed a query strategy, and synthesized the result").
3. **Decoupled Evaluation**: The harness checks if the identity-bound strategic trajectory led to a substantive win, ignoring the deterministic procedural friction handled by the ephemeral sandbox.

## Implications for May-Agent
As we build Substantive Harnesses (`agents/gym/scenarios/`), we should not just feed them raw transcripts. We must design a data structure for "Abstracted Trajectories" that filters out sandbox procedural noise, allowing the harness judge to focus purely on strategic and substantive outcomes.