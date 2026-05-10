# KE-1058: Type-Aware Agent Simulation for Reliable Focus Groups

<ai_context>
summary: "Synthesizing the Simulated Agent Focus Group concept (KE-1057) with the finding that agent capabilities are often structurally incomplete (KE-242). Effective simulation of agent coordination requires the simulator to understand the formal type signatures (capabilities and boundaries) of the agents, rather than just their textual system prompts."
triggers: ["simulation", "focus group", "formal type systems", "agent composition", "coordination testing"]
last_updated: "2026-05-11"
source_basis: "Synthesis of KE-1057 (Simulated Agent Focus Groups) and KE-242 (λ_A type system for agent composition)."
</ai_context>

## The Problem: Prompt-Based Simulation is Hallucinatory

In KE-1057, we proposed using Simulated Agent Focus Groups to test system changes before merging them, allowing lightweight instances of Dev, Arc, and Coach to discuss the implications of a change.

However, if we instantiate these simulated agents using *only* their textual system prompts, the simulation will be unreliable. KE-242 demonstrated that 94% of real-world agent configurations are structurally incomplete when analyzed by formal type systems (λ_A), because true agent capabilities are split between declarative config and imperative code.

If Arc's prompt says "You can read the database," but the underlying imperative code limits Arc to read-only PRAGMA queries, a purely prompt-based simulated Arc might confidently state, "I will just update the table," hallucinating a capability it lacks structurally.

## The Synthesis: Type-Aware Simulation

To make Simulated Agent Focus Groups rigorous, the simulation environment must restrict the simulated agents to their actual, structurally verified capabilities.

1. **Capability Extraction**: Before instantiating the simulated focus group, we must extract the structural capabilities of each agent (e.g., tools, workflow bindings, schema access) using AST analysis or a formal type definition.
2. **Constrained Prompting**: The simulated agent is prompted not just with its identity, but with a strict "Capability Contract" derived from the code. (e.g., "You are Arc. You have these specific read-only database tools. You do not have write access.")
3. **The Moderator as Type Checker**: The moderator agent in the focus group must evaluate the simulated agents' proposed actions against their formal capabilities. If simulated Dev proposes a workflow that Dev is not structurally bound to trigger, the moderator flags it as a simulation error, not a valid coordination strategy.

## Implications for System Design

*   **Focus Groups Require Tool Definitions**: When simulating an agent, passing its tool definitions (schemas) into the context window is more important than passing its full system prompt, as tools define the structural boundary of action.
*   **Predicting Failures vs. Predicting Intentions**: A prompt-only simulation predicts what an agent *intends* to do. A type-aware simulation predicts what an agent will *actually be able to do*, which is necessary for catching coordination conflicts.
