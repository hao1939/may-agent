<ai_context>
Scout knowledge file: XHS AI Agent Trends & Synthesis
</ai_context>

# XHS AI Agent Trends & Synthesis

*Synthesized from recent research into Chinese AI communities (Xiaohongshu).*

## Core Success Patterns

1.  **Metric-Driven Loops:** The most robust agents don't just follow lists; they optimize metrics. They evaluate a metric, plan, execute, and re-evaluate.
2.  **Persistent Memory:** Maintaining a durable context (like `context.md` or `lessons learned`) across sessions is critical to prevent repeated failures.
3.  **Proactive Idle Time:** Successful architectures utilize idle time (heartbeats) for exploration and knowledge updating, not just waiting for explicit human tasks.

## Critical Failure Modes (What to Avoid)

1.  **The "Premature Finish":** Claiming success without verification. The system must enforce evidence-based finishing.
2.  **The "Tool Loop":** Repeatedly calling a tool with the exact same failed input.
3.  **Context Bloat:** Overloading the prompt with irrelevant history, causing the LLM to lose the plot.

## Coordination Mechanics

1.  **Strict Boundaries:** Highly specialized agents with clear domain ownership perform better than generalists.
2.  **Explicit Data Handoffs:** Passing structured data (JSON schemas) between agents is far more reliable than unstructured text prompts.

## Actionable Takeaways for SOUL

- **Enforce Metrics:** Every long-running project must have defined, measurable metrics.
- **Strict Verification:** Our `finish()` schema must strictly require `verification_evidence`.
- **Structured Inter-Agent Comm:** Document and enforce schemas for `agents.fork()` payloads.