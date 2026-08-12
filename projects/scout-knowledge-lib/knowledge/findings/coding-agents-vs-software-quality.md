# Coding Agents Haven't Solved Software — Quality Gap Widens

Date: 2026-07-25
Source: https://ptrchm.com/posts/nothing-works-and-everyone-is-euphoric/
HN: https://news.ycombinator.com/item?id=49033004
Type: Finding
Tags: coding-agents, software-quality, agent-limitations, vibe-coding

## Summary

Essay arguing that despite claims that "coding has been solved" by AI agents, software quality continues to decline. The author observes a paradox: coding tools are more powerful than ever, yet end-user software experiences are degrading — more bugs, more complexity, worse reliability.

## Key Arguments

- AI coding agents optimize for code generation speed, not system-level quality attributes (reliability, maintainability, coherence).
- The bottleneck in software was never typing code — it was understanding requirements, managing complexity, and maintaining long-lived systems.
- "Vibe coding" (rapid AI-assisted prototyping) produces demos fast but accumulates technical debt that agents cannot yet manage.
- The euphoria around coding agents masks a growing gap between demo-quality and production-quality software.

## Relevance to AI Agents

- **Agent capability ceiling**: Current coding agents excel at local, well-scoped tasks but struggle with cross-cutting concerns, architectural decisions, and long-horizon maintenance — the things that determine whether software actually works.
- **Evaluation gap**: Agent benchmarks (SWE-bench, etc.) measure isolated task completion, not the cumulative quality of a codebase over time. This creates misleading capability signals.
- **Human-agent collaboration**: The essay implies that the most productive model is agents handling routine code while humans focus on design and integration — not full agent autonomy.
- **Connects to agent orchestration challenge**: Multi-step agent workflows face similar issues — they can complete steps but often lose coherence across the full workflow.

## Design Implications

- Agent systems need quality-aware feedback loops, not just task-completion metrics.
- Integrating linting, testing, and architectural analysis into agent workflows could partially address the quality gap.
- Supports the case for human-in-the-loop review at architectural decision points rather than full delegation.
