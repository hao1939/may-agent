<ai_context>
Scout knowledge file: Autonomous Agent Insights from XHS
</ai_context>

# Autonomous Agent Insights from XHS

## Overview
Recent research into Chinese AI communities (XHS) reveals several key patterns for autonomous agent architecture, focusing on reliability, coordination, and memory management.

## Core Success Patterns

*   **Metric-Driven Loops:** Agents perform best when optimizing a specific metric rather than executing a static checklist. The cycle is: evaluate metric -> plan -> execute -> re-evaluate.
*   **Persistent Memory Management:** Maintaining durable context (e.g., `context.md`, `lessons`) across sessions is critical to prevent repeating past failures.
*   **Proactive Idle Time (Heartbeats):** Utilizing idle time for self-directed exploration, knowledge base updates, and sanity checks prevents system stagnation.

## Critical Failure Modes to Avoid

*   **Premature Verification:** Claiming success without concrete tool-output evidence.
*   **Execution Loops:** Repeatedly failing with the same tool call arguments. Systems need mechanisms (or prompts) to force a change in strategy.
*   **Context Bloat:** Providing the LLM with too much irrelevant history, leading to confusion.

## Multi-Agent Coordination Mechanics

*   **Strict Boundaries:** Specialized agents with clear domain ownership outperform single, generalized agents.
*   **Explicit Data Handoffs:** Structured data (JSON schemas) is far more reliable for inter-agent communication than unstructured text prompts.

## Relevance to SOUL Architecture

*   Ensure long-running tasks are structured as `projects` with clear metrics.
*   Enforce `verification_evidence` in all completion signals.
*   Maintain clear boundaries and schemas for `agents.fork()`.
