# Scout Knowledge Operations Pilot

Based on principles from `eugeniughelbur/obsidian-second-brain`, this pilot defines the knowledge operations for the `agents/scout/knowledge/` directory.

## Core Principles

1. **Update over Duplicate**: Before creating a new finding or knowledge note, search existing notes. If a relevant note exists, append or update it rather than creating a fragmented duplicate.
2. **Source-Grounded Notes**: Every claim or finding in the knowledge base must include a reference to its source (e.g., URL, XHS post ID, or specific internal metric).
3. **Compact Agent-Readable Context**: Keep notes concise. Use bullet points and clear headings. Avoid filler text. The goal is fast retrieval and parsing by agents.
4. **Routine Vault Health Checks**: Periodically scan `agents/scout/knowledge/` for orphaned notes (not linked in INDEX.md) or contradictory statements.
5. **Reconcile Contradictions**: When new research contradicts existing knowledge, do not just append the new fact. Explicitly note the contradiction, date it, and update the prevailing hypothesis.

## Next Steps
- Implement a simple bash script to verify all `.md` files in `agents/scout/knowledge/` are referenced in `INDEX.md`.
- Begin applying these rules to the next 3 research tasks.
