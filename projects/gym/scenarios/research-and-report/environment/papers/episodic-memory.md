# Episodic Memory for Autonomous Agents: Temporal Contextualization and Replay

**Authors:** Chen, Nakamura, Osei (2024)
**Venue:** Workshop on Cognitive Architectures for AI Agents, AAAI 2024

## Abstract

We propose EpisodicBuffer, a memory architecture for autonomous agents that stores experiences as timestamped episodes — sequences of (observation, action, outcome) triples anchored to task context. Unlike flat retrieval-augmented approaches, EpisodicBuffer preserves temporal ordering and causal relationships between actions, enabling agents to recall not just *what* happened but *how* a situation unfolded.

## Approach

Each episode is bounded by a task lifecycle (start → completion/abandonment). Within an episode, the agent records state snapshots at decision points rather than continuously, reducing storage by ~80% compared to full-trace logging. Episodes are indexed by a combination of semantic embedding and structural tags (task type, tools used, outcome status). Retrieval uses a two-phase process: coarse filtering by structural tags, then fine-grained ranking by embedding similarity to the current context.

## Key Results

On the AgentBench suite, EpisodicBuffer improved task completion by 12% over RAG-only baselines, with the largest gains on multi-step debugging tasks where prior failure sequences were informative. The temporal ordering proved critical — shuffled episodes performed 8% worse than ordered ones, confirming that causal structure carries signal. However, performance gains plateaued after ~500 stored episodes, suggesting a forgetting or compression mechanism is needed for long-lived agents. Storage overhead was 2.1KB per episode average. Retrieval latency averaged 45ms for a 1000-episode store.

## Limitations

The approach struggles with cross-task transfer — episodes from task A rarely help with unrelated task B. The episode boundary detection (task start/end) requires explicit signals and fails in ambiguous multi-task scenarios. No mechanism exists for generalizing across similar episodes into abstract patterns.
