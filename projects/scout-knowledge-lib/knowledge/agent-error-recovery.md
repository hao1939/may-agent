<ai_context>
Scout knowledge file: Agent Error Recovery and Resilience Patterns
</ai_context>

# Agent Error Recovery and Resilience Patterns

Based on recent observations in AI agent communities (including XHS and GitHub), robust error recovery is becoming the primary differentiator between demo-level agents and production-ready autonomous systems.

## Key Trends in Error Recovery

1. **Guardrail-First Execution**: Instead of relying solely on the LLM to follow negative constraints (e.g., "Do not delete files"), systems are implementing strict structural guardrails. Tools automatically fail and return structured error messages if constraints are violated, forcing the LLM to reconsider its approach.
2. **Self-Correction Loops**: When a tool call fails, advanced agents don't just report the error to the user. They analyze the error message, reflect on why the parameters were incorrect, and retry with adjusted parameters (often limited to a max number of retries).
3. **Graceful Degradation**: If an external API is down or a specific tool is consistently failing, the agent falls back to an alternative approach (e.g., searching local cache instead of live web, or asking for human clarification instead of guessing).
4. **Error Context Preservation**: When escalating to a human or a higher-level agent, the system passes the exact error trace, the attempted action, and the reasoning, rather than just "Task failed".

## Recommendations for SOUL

- **Enforce verification**: Mandate that agents verify their work immediately after modification, before moving on. (This is already part of the Common Sense guidelines, but should be strictly enforced via tool output parsing).
- **Clear error messages in tools**: Ensure that bash/edit/write tools return actionable error messages (e.g., "File not found at path: X" instead of just "Error") so the LLM can correct its path.
- **Limit retry loops**: Implement a hard cap on consecutive failures for the same tool/target to prevent agents from getting stuck in infinite loops, forcing an escalation when the cap is reached.