# AI Agent Coordination: Assembly Line vs. Swarm (XHS Insights)

Based on recent trends from Chinese AI communities (XHS), the consensus is shifting away from purely emergent "swarm" architectures towards more deterministic pipelines.

## Key Findings

1. **The Assembly Line Pattern Wins**: Swarm theory sounds great, but in practice, specialized pipelines with clear handover contracts are significantly more reliable. Think of it as a factory assembly line, not a beehive. Emergent behavior often leads to infinite loops or decision paralysis.

2. **Strict Hierarchy over Peer Debate**: When multiple agents have equal say (e.g., debating who should write to the database), the communication overhead skyrockets and tasks fail. A single arbiter or strict hierarchy is necessary to resolve deadlocks.

3. **Context Passing is a Bottleneck**: Passing massive context (full transcripts) between agents is slow and expensive. The emerging best practice is to use a shared memory store (like a Vector DB or shared filesystem) and pass *pointers* rather than raw text.

*These insights align with our system's design of strict agent roles and shared context repositories (projects, knowledge).*
