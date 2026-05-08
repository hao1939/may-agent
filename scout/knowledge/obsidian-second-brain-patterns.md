# obsidian-second-brain Patterns

## Applicable Ideas
- **Notes for AI, not humans**: The "AI-first vault rule" where notes have a preamble for future-AI, machine-readable structure, and recency markers. Instead of human-readable wikis, the context is built for retrieval.
  - *Source evidence: "Note format: AI-first: `## For future Claude` preamble + frontmatter for LLM retrieval, not human review" (README.md).*
- **Rewriting instead of appending**: When new information arrives, existing notes are updated, and contradictions are reconciled automatically, rather than just appending new disjointed files.
  - *Source evidence: "New sources: Rewrite existing pages. People get updated, claims revised, stale facts replaced" (README.md).*
- **Vault-first deep research**: Before researching externally, the system scans existing knowledge to find what's already known, identifying only the gaps to research (delta report).
  - *Source evidence: "Vault-first synthesis knows what you already know and fills only the gaps" (README.md).*
- **Background Scheduled Agents**: Agents running on a cron schedule (nightly, weekly) to synthesize cross-source patterns, resolve contradictions, and clean up the knowledge base while the user sleeps.
  - *Source evidence: "4 scheduled agents: nightly close, weekly review, contradiction sweep, vault-health check" (README.md).*

## Non-Applicable Ideas
- **Obsidian/Markdown specific tooling**: We don't need Obsidian-specific UI or local filesystem setups. Our system is already a bespoke agentic workspace.
- **31 different specific slash commands**: Our agent interaction model (projects, heartbeats, natural language) is better than a rigid set of 31 specific operations.
- **Kanban boards for agents**: We use projects/metrics/tasks tracked in DB/md, not literal kanban boards.

## Risks
- **Destructive updates**: Rewriting notes instead of appending risks losing valuable context if the AI makes a mistake during synthesis or reconciliation.
- **Cost/Token explosion**: Continually scanning the entire vault to find "what we already know" (like the `/research-deep` pattern) could get very expensive or hit context limits fast without proper retrieval (RAG or vector search).
- **Hallucinated connections**: Aggressive background synthesis might connect unrelated things just because they share keywords, muddying the knowledge base.

## Smallest Scout-only Pilot
1. **AI-First Preamble on Knowledge Files**: Update one of scout's knowledge files (e.g., this one) to explicitly include an AI-first preamble ("For future agents:") and structured recency markers.
2. **Scheduled Synthesis Heartbeat**: Use scout's heartbeat to periodically read 2-3 existing knowledge files and attempt to synthesize a new pattern or reconcile contradictory facts, writing the result back.
3. **Delta-Research Action**: Create a specific workflow or script for scout where, before doing web research on a topic, it explicitly summarizes existing workspace knowledge first.
