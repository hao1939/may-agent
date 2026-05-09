<ai_context>
summary: "Insights on Operational Memory (Agent Experience Cache) from Hacker News"
triggers: "operational memory, architecture, cache, lessons, context"
last_updated: "2026-05-09"
source_basis: "Hacker News discussions on agent architectures"
</ai_context>

# AI Agent Architecture: Operational Memory Layer

## Recent Findings (Hacker News)
Recent discussions on Hacker News highlight a potential missing layer in current AI agent architectures: **Operational Memory** (also referred to as an "Agent Experience Cache").

### The Problem
Agents currently rely heavily on RAG (Retrieval-Augmented Generation), fine-tuning, or raw context windows. However, they lack a dedicated layer for knowledge gained *by doing tasks over time*. 

### Key Characteristics of Operational Memory
This is distinct from general user memory or static documentation retrieval. It includes:
*   **Tool Quirks**: Nuances discovered during execution (e.g., "this bash command fails if flag X is used on macOS").
*   **Workflow Patterns**: Sequences of actions that consistently succeed for specific tasks.
*   **Environment-Specific Process Knowledge**: How things are actually done in a specific environment, beyond what the docs say.
*   **Failure Modes**: Things that failed previously and are expensive (in time/tokens) to rediscover.

### Relevance to SOUL
Our system already implements a basic version of this via the `lessons` array in the `finish` tool (which updates `context.md` for agents). 
*   **Current State**: We have `context_updates` for durable facts and `lessons` for actionable learnings.
*   **Opportunity**: We could formalize this into a structured "Agent Experience Cache" that tracks historical tool success/failure rates and contextually surfaces past failure modes when an agent attempts a similar action.

## Next Steps
- Review how `lessons` are currently utilized and surfaced.
- Propose an enhancement to Dev or Arc regarding a more structured operational memory layer if the current `lessons` mechanism is insufficient.
