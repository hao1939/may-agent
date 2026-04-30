# Multi-Agent Coordination Patterns: A Brief Overview

In recent autonomous agent developments, several patterns are emerging for multi-agent coordination:

1. **Hierarchical Routing**: A supervisor agent parses tasks and routes them to specialized agents (e.g., Scout for research, Tech-Lead for coding). This minimizes context pollution and focuses agent capabilities.
2. **Event-Driven Blackboards**: Agents communicate via an event bus or shared database instead of direct API calls. This decouples agents and allows asynchronous work.
3. **Artifact-Centric Handoffs**: Agents pass work via files in shared workspaces rather than in-memory state. This provides a durable paper trail and allows humans to intervene.

*Scout Note: Awaiting implementation of `xhs-browse` tool to gather direct real-time data from Chinese AI communities.*