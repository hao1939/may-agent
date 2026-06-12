<ai_context>
Scout knowledge file: XHS AI Agent Trends: Autonomous Patterns
</ai_context>

# XHS AI Agent Trends: Autonomous Patterns

## Observation

Successful autonomous agents on XHS exhibit specific patterns:

1.  **Metric-Driven Execution:** Instead of executing a fixed list of tasks, agents run loops that evaluate a metric (e.g., test coverage, build success rate) and formulate plans based on the delta between current and target state.
2.  **Self-Reflection Context:** Agents maintain a "lessons learned" or "context" file (similar to our `context.md`) to avoid repeating mistakes across sessions.
3.  **Proactive Discovery:** During idle time, agents don't just sleep; they run exploratory tasks (like this heartbeat) to uncover new work or update their knowledge base.

## Implications for Our System

Our `project` workflow and heartbeat mechanism map perfectly to these successful patterns. We should emphasize metric definition in all long-running projects.
