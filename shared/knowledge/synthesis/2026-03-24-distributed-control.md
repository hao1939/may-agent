# Synthesis: Distributed Cognition & Coordination Costs (DD#390 + DD#391)
**Date:** 2026-03-23
**Sources:**
- DD#390: BIGMAS (Brain-Inspired Graph MAS, Centralized)
- DD#391: LLM Teams as Distributed Systems (Decentralized Limits)

## The Central Tension
We now have two definitive theoretical frameworks that pull in opposite directions, and their intersection defines the optimal architecture for our system.

### 1. The Distributed Systems Limit (DD#391)
- **Thesis:** Decentralized agent teams inherit the flaws of distributed systems: O(n²) communication overhead, consistency conflicts, and Amdahl's Law scaling limits.
- **Finding:** Decentralized teams are often *slower* and *more expensive* (9.6x cost/work) than single agents.
- **Implication:** "Just add more agents" is a failed strategy. Coordination cost eats the gains.

### 2. The Global Workspace Solution (DD#390)
- **Thesis:** A centralized "Global Workspace" (shared state, visible to all) + Orchestrator (dynamic graph design) solves the coordination problem.
- **Finding:** BIGMAS yields +36% gains on hard reasoning tasks by dynamically constructing the *right* agent topology per problem.
- **Implication:** The winning architecture is **Centralized State + Dynamic Topology**.

## Synthesis: The "Sidecar" Pattern Validated
Our recent push for a "Control Plane Sidecar" (Active Nudging, OpBudget enforcement) is strongly validated by these findings.
- **DD#391** proves that asking agents to self-coordinate (decentralized) leads to consistency violations and overhead.
- **DD#390** proves that a centralized orchestrator (Manager/Sidecar) optimizing the flow leads to higher performance.

## Design Principles (Draft)
1. **Centralize State, Distribute Compute**: Agents should not peer-to-peer handoff complex state (O(n²) risk). They should write to a shared workspace (Global Workspace) that the Orchestrator (Manager) routes.
2. **Topology is Dynamic**: We shouldn't have fixed "pipelines". The Manager (or a GraphDesigner agent) should decide: "This task needs Scout -> Coder -> QA", while "That task needs just Bob".
3. **Coordination is Expensive**: Default to single-agent execution. Only spin up a team when the task's serial fraction is low enough to justify the Amdahl penalty.

## Recommendations
1. **Abandon Pure Decentralization**: Stop trying to make agents "talk to each other" autonomously for complex workflows. It's too expensive (Law 42).
2. **Harden the Global Workspace**: Our file system *is* our Global Workspace. We need to protect its consistency (Locking/Versioning) to prevent the "Concurrent Write" violations seen in DD#391.
3. **Adopt "Active Nudging" as Orchestration**: Our "Wink" implementation is a primitive form of the BIGMAS Orchestrator — intervening when the graph topology (loop) is failing.

## Next Steps
- **Immediate**: Continue "Active Nudging" rollout (it's our Orchestrator).
- **Medium**: Investigate a "GraphDesigner" capability — an agent that reads a complex user request and outputs a `task_dependency_graph.json` for May to execute.
- **Long**: Implement "Token Coherence" (DD#386) or similar locking on shared workspace files.
