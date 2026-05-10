# KE-1049: The "Agent OS" and "Harness" Convergence - Ephemeral Identity Runtimes

## <ai_context>
**Summary**: Synthesizing the concepts of the "Agent OS" (KE-1044), "Harnesses" (KE-1044/1046), and "Trajectory Passports" (KE-1047). The next logical evolution in agent architecture is the "Ephemeral Identity Runtime"—an environment spun up uniquely for a specific agent identity to solve a specific problem, evaluated immediately by a specialized harness, and then destroyed.
**Triggers**: architecture, operating system, harness, identity, ephemeral, runtime
**Last Updated**: 2026-05-11
**Source Basis**: Synthesis of KE-1044 (Agent OS), KE-1044 (Harnesses), KE-1046 (Prompt Coupling), and KE-1047 (Trajectory Identity).
## </ai_context>

## The Convergence

Recent architectural trends have isolated three distinct layers for advanced agent systems:
1. **The Substantive Harness (KE-1044/1046)**: Evaluating intent and outcome over raw procedural logs.
2. **The Agent OS (KE-1044)**: Abstracting away low-level mechanics (storage, tool permissions) so the agent focuses on cognition.
3. **Trajectory Passports (KE-1047)**: Stamping actions with cryptographically verifiable or strongly typed identity markers.

When viewed together, a new meta-pattern emerges: **The Ephemeral Identity Runtime (EIR).**

### What is an Ephemeral Identity Runtime?

Currently, agent platforms are persistent environments where multiple agents operate, read logs, and try to deduce what happened. This causes cross-contamination of context and makes evaluation noisy.

An EIR flips this model:
1. A task arrives.
2. A unique, ephemeral "Agent OS" instance is provisioned specifically for that task.
3. The environment is heavily coupled to the agent's specific role (KE-1046).
4. As the agent operates, every action is automatically stamped with its Identity Passport (KE-1047), removing the need for manual contextualization.
5. Upon task completion, the bespoke Substantive Harness evaluates the *identified trajectory* within that specific OS context.
6. The environment is destroyed; only the summarized, evaluated abstract trajectory is persisted to the central system.

## Implications for May-Agent Architecture

The May-Agent system already moves in this direction with `agents/gym/scenarios/`, but we are still fighting shared-state friction (e.g., metric evaluation noise, database write conflicts).

To fully embrace the EIR pattern:
*   **Decoupled State**: We must ensure that execution environments (sandboxes) for agents like `dev` or `arc` are truly isolated and ephemeral, not just logical separations in a shared filesystem.
*   **Harness Integration**: The evaluation harness should not run *after* the session in the main DB; it should be part of the tear-down process of the ephemeral OS instance.
*   **Identity as First-Class Construct**: Tools should automatically infer identity from the runtime environment rather than requiring the agent to declare it, reducing procedural noise.