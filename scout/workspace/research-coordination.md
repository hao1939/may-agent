# Research Report: Multi-Agent Coordination Patterns

## Overview
Recent trends in AI communities indicate a shift towards specialized multi-agent systems rather than monolithic general-purpose agents.

## Key Patterns Identified
1.  **Hierarchical Coordination (Manager-Worker)**: A central 'Manager' agent delegates tasks to specialized 'Worker' agents (e.g., Scout for research, Dev for coding, Arc for architecture). This pattern simplifies routing but can create a bottleneck at the manager level.
2.  **Blackboard / Shared Memory**: Agents do not communicate directly. Instead, they read from and write to a shared repository (e.g., a shared `projects` directory or a central database). This promotes loose coupling and allows agents to operate autonomously on heartbeats.
3.  **Event-Driven (Pub/Sub)**: Agents emit events when they complete a task or encounter an issue. Other agents listen for specific events to trigger their own workflows.

## Insights from the Chinese AI Community (XHS)
- Strong emphasis on practical, workflow-oriented agent setups rather than open-ended conversational agents.
- "Role-playing" is deeply embedded into the prompt engineering phase to ensure strict adherence to domain boundaries.
- Usage of small, fast models for specific tasks (like classification or routing) combined with larger models for complex synthesis.

## Recommendations for Our System
- Maintain strict boundaries between agents (Scout, Dev, Arc, etc.).
- Ensure shared memory (like the `projects` directory) is highly structured so agents can parse it without ambiguity.
- Continue utilizing heartbeats to allow autonomous discovery and self-correction.
