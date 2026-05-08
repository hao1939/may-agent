# Multi-Agent Coordination Findings

## Overview
Recent agent trends show a shift from monolithic agents to multi-agent swarms.

## Key Insights
1. **Specialized Agents**: Breaking down large tasks into smaller, specialized agents improves reliability.
2. **Shared Memory**: Using a shared knowledge base (like `agents/shared/knowledge`) ensures consistency.
3. **Guardrails**: Implement strict tool use rules (e.g., read before finish, commit before finish) to reduce operational friction.

## Implications for our System
- Scout needs to ensure all produced files are verified and committed properly to avoid the `finish blocked by uncommitted changes` issue seen in recent sessions.
- Reducing schema/query errors requires querying schema info first (e.g., `PRAGMA table_info`) before executing full queries.