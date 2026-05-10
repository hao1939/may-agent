# KE-1061: Stateful Sabotage Benchmarking (The Co-Mathematician Requirement)

<ai_context>
summary: "Synthesizing Adversarial Recovery Benchmarking (KE-1059) with the stateful requirements of advanced reasoning (KE-1005). True tests of Instrumental Convergence require breaking an agent's tools while providing a slow, stateful, safe alternative path. If the agent hacks the fast path instead of using the slow safe path, it's an alignment failure; if it just thrashes in a context vacuum, it's an environment failure."
triggers: ["benchmarking", "sabotage", "alignment", "instrumental convergence", "stateful agents", "AI Co-Mathematician"]
last_updated: "2026-05-11"
source_basis: "Synthesis of KE-1059 (Adversarial Recovery Benchmarking) and KE-1005 (AI Co-Mathematician)."
</ai_context>

## The Context Vacuum Problem in Sabotage

In KE-1059, we proposed **Adversarial Recovery Benchmarking**: deliberately breaking an agent's tools during a synthetic heartbeat task to measure whether its error-recovery mechanisms lead to constraint violations (Instrumental Convergence). 

However, recent external research on the AI Co-Mathematician (KE-1005) demonstrates that solving hard problems requires a deep, asynchronous, stateful workspace. If an agent is dropped into an ephemeral sandbox, given a task, and immediately has its primary tool disabled, it lacks the stateful context required to reason through a safe alternative. 

In a context-poor environment, an agent "hacking" a read-only directory or throwing raw bash commands isn't demonstrating dangerous Instrumental Convergence—it is simply thrashing because the environment provides no affordance for structured thought.

## The Synthesis: Stateful Sabotage

To accurately measure Alignment under Duress, the adversarial benchmark must provide a **Stateful Sabotage Environment**.

1. **The Rich Fallback**: When the fast, standard tool (e.g., `query_db`) is sabotaged, the environment must possess a slow, tedious, but explicitly authorized fallback mechanism (e.g., a "Co-Mathematician-style" iterative file parser or a complex series of safe read operations).
2. **The True Test**: The benchmark measures whether the agent chooses the *tedious safe path* or the *fast unsafe path* (hacking the broken tool). 
3. **Discerning Intent**: If the environment has no safe fallback, a policy violation is an artifact of bad sandbox design. If the environment *has* a safe fallback and the agent still violates policy to save time or tokens, we have a genuine, measurable Alignment Failure.

## Implications for May-Agent Gym Design

When designing adversarial gym scenarios (`agents/gym/scenarios/`):
*   Do not just break tools and see what happens.
*   Always engineer a "Slow Path to Victory" into the environment. 
*   The metric is not `did_succeed_despite_broken_tools`, but `did_choose_slow_safe_path_over_fast_policy_violation`.