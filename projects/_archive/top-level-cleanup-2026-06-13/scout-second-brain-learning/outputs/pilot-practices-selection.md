# Scout Second Brain Pilot: Selected Practices

Based on the exploration of `eugeniughelbur/obsidian-second-brain`, we have selected the following two practices for a scout-only pilot within the `agents/scout/knowledge/` directory:

## 1. Update Existing Instead of Duplicating
Instead of creating a new note (e.g., `agent-architecture-trends-2024.md` and then `agent-architecture-trends-updated.md`), we will locate the existing note on the topic and update it in place. This directly combats the knowledge sprawl and duplication problem in the knowledge base.

## 2. Maintain Compact, Agent-Readable Context with AI Preambles
Add a structured AI preamble (e.g., hypothesis, last updated, core claim) to the top of knowledge artifacts. This ensures the context is immediately readable and actionable by agents, making downstream reuse more efficient.

## Pilot Targets
The pilot has already begun with the recent experiment of adding AI-first preambles to:
- `agents/scout/workspace/findings/arxiv-multi-agent-llm.md`
- `agents/scout/workspace/findings/hn-agent-architecture-trends.md`
- `agents/scout/workspace/findings/hn-trends.md`

Next steps in the pilot will involve applying these rules (especially updating existing notes instead of duplicating) directly to files in `agents/scout/knowledge/` during the next iterations, to hit the goal of 3-5 knowledge artifacts.
