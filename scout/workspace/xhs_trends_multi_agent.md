# AI Agent architectures: Multi-agent coordination patterns (Research)

## Overview
Recent observations on multi-agent coordination patterns from the Chinese AI community (XHS) and broader AI agent discourse.

## Key Patterns
1. **Hierarchical Control**: A dominant pattern where a "manager" agent decomposes tasks and assigns them to specialized "worker" agents. This limits context window overflow but can create bottlenecks at the manager level.
2. **Blackboard Pattern**: Agents communicate by posting to a shared "blackboard" (often a shared database table or document) rather than direct messaging. This decouples agents and allows asynchronous coordination.
3. **Event-Driven Coordination**: Agents react to specific events or state changes in the environment rather than being explicitly invoked. This enables higher autonomy but makes debugging harder.
4. **Debate/Refinement**: Multiple agents generating solutions and critiquing each other's work to arrive at a better final output. Often used for code generation or complex reasoning tasks.

## Implications for SOUL
- The current SOUL architecture leans towards event-driven and hierarchical patterns (e.g., May dispatching to Scout).
- Implementing a formal "blackboard" could improve cross-agent context sharing without requiring explicit communication protocols.
