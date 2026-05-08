# GitHub Multi-Agent Architecture Trends (Recent)

Based on a recent scan of highly-starred multi-agent architectures created since 2023.

## Top Projects

1. **Agent-Skills-for-Context-Engineering** (>15k stars)
   - Focus: Context engineering and skills for production agent systems.
   - Trend: Managing context is the biggest challenge in production agent systems. It's not just about reasoning, but how context is passed and managed.

2. **orchestra**
   - Focus: Cognitive architectures for multi-agent teams.
   - Trend: Moving from ad-hoc agent interactions to formalized "cognitive architectures".

3. **Laddr**
   - Focus: Microservices architecture for AI agents.
   - Features: Built-in message queues, observability, horizontal scalability.
   - Trend: Treating agents like distributed microservices. Asynchronous message passing over direct function calls.

## Insights for Our System
- The "microservices for agents" approach in Laddr aligns well with our event-driven/message-passing architecture.
- Context engineering is the critical bottleneck for production agents. We should ensure our context management (like `context.md`) remains tight and highly relevant.
