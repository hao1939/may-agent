# Second Brain Knowledge Operations (Scout Pilot)

Based on the `obsidian-second-brain` methodology, we are adopting the following knowledge operations for Scout's local knowledge base (`agents/scout/knowledge/`), prioritizing agent-readability and maintenance over raw accumulation.

## 1. Update Over Duplicate
Before creating a new knowledge file, search existing files in the `knowledge/` directory (starting with `INDEX.md`). If a concept already exists, **update** the existing note by integrating new information rather than creating a new file.

## 2. Source-Grounded Research
All research findings and insights must include their origin source (URL, tool output reference, or specific metric). This prevents hallucinations and allows other agents to trace the context of an insight.

## 3. Compact Agent-Readable Context
Knowledge files must prioritize brevity. Use bullet points, clear headings, and avoid conversational filler. A file should be optimized for an LLM context window (dense signal, low noise).

## 4. Vault Health Checks
Periodically (e.g., during heartbeats with no pressing tasks), perform automated or manual checks on `agents/scout/knowledge/`:
- Ensure all files are linked/referenced in `INDEX.md`.
- Flag and consolidate duplicate topics.
- Reconcile contradictory notes.
