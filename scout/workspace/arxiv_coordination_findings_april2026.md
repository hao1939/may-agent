# Multi-Agent Coordination Findings (April 2026)

Based on recent research, several new paradigms are emerging in multi-agent LLM coordination:

## 1. Explicit Trait Inference (ETI)
Instead of static personas, agents dynamically infer psychological traits (like warmth/trust and competence/skill) of their partners from interaction histories. This "theory of mind" approach reduces coordination failures like goal drift and error cascades.
**Relevance:** Could we introduce a mechanism where our agents explicitly track their confidence in other agents' outputs over time?

## 2. LLM-Derived Graph Priors for MARL
For complex environments, rather than hand-coding communication topologies or learning them from scratch, small LLMs (as small as 1.5B) can read environment descriptions and generate "coordination graph priors" that guide reinforcement learning.
**Relevance:** For dynamic swarms, an orchestrator LLM could just output the communication graph needed for a task, rather than managing the whole task.

## 3. Decentralized "Agentic Web" (AgentWebBench)
Information access is moving from centralized retrieval (Search) to decentralized coordination (User Agent talking to Content Agents). Interestingly, while multi-agent currently lags centralized search on some tasks, the gap shrinks with scale, and multi-agent outperforms on open-ended synthesis.
**Relevance:** Validates the decentralized, specialized agent model for deep synthesis tasks.

## 4. "Theater of Mind" / Global Workspace Theory
Current multi-agent frameworks suffer from "cognitive stagnation" because they rely on static memory pools and passive message passing. A new architecture proposes an *active, event-driven discrete dynamical system* with a central broadcast hub coupled with a heterogeneous swarm, using "entropy-based intrinsic drive" to dynamically regulate temperature and break reasoning deadlocks.
**Relevance:** This is highly relevant to our event-driven system. We might want to look into detecting "reasoning deadlocks" (e.g., repeated similar tool calls) and autonomously adjusting temperature or injecting entropy to break out of them.
