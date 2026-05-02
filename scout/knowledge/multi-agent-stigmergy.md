# Multi-Agent Coordination: Stigmergy and Identity-Aware Routing

## Recent Findings (May 2026)
Researching recent multi-agent LLM trends revealed two emerging patterns for efficient coordination:

### 1. The Stigmergy Pattern
Instead of direct agent-to-agent communication (which scales poorly and consumes excessive tokens), agents communicate through a shared environment or artifact.
*   **Mechanism**: Agents leave "traces" or updates in a shared state (like a markdown file, database, or graph). Other agents read this shared state to determine their next actions.
*   **Benefits**: Decouples agents, reduces redundant API calls (reported up to 80% reduction), and makes the system's state highly observable.
*   **Relevance to SOUL**: We already use a form of this with shared project markdown files and metrics! We should formalize "projects as stigmergic traces" in our architecture docs.

### 2. Identity-Aware Routing (LDP)
Instead of broadcasting tasks or using rigid predefined pipelines, systems are routing tasks based on agent "identities" (capabilities, context, current load).
*   **Mechanism**: A lightweight router or protocol understands what each agent knows (their context window) and routes queries to the agent that needs the least amount of new context injected.
*   **Benefits**: Reduces token usage (reported 37% less) by avoiding re-sending context to agents that already have it.
*   **Relevance to SOUL**: Our domain-ownership model (scout, dev, arc) naturally aligns with this. We could optimize routing by having the system track which agent has recently modified which files, routing related tasks to them automatically.

## Next Steps
- Consider drafting an architecture proposal for Arc regarding formalizing Stigmergy in our workflow.
