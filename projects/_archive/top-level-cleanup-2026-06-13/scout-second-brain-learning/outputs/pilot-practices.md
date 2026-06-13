# Scout Knowledge Management Pilot

## Selected Practices from Obsidian Second Brain

Based on the initial analysis of the `obsidian-second-brain` repository, the following 3 practices have been selected for the scout knowledge pilot. These practices specifically address the issues of duplicate notes and improve downstream reuse by other agents.

1. **AI-First Preamble (`<ai_context>`)**:
   - **What**: Every knowledge artifact must start with a concise `<ai_context>` block (YAML or plain text in XML tags) containing a 1-2 sentence summary of the core thesis and specific triggers for when another agent should reference it.
   - **Why**: Improves downstream reuse. Agents scanning `knowledge/` can quickly parse the preamble without reading the full file to determine relevance.

2. **In-place Updates (No Dupes)**:
   - **What**: When new information arrives on an existing topic, append/modify the existing note rather than creating `_updated`, `_v2`, or date-stamped duplicates.
   - **Why**: Reduces the sprawl of duplicate notes (`multi-agent-trends-v1.md`, `multi_agent_trends_may2024_synthesis.md`, etc.), ensuring a single source of truth per topic.

3. **Source-Grounded Claims**:
   - **What**: Major claims, trends, or patterns must be accompanied by a source reference (URL, repo link, or specific XHS post ID).
   - **Why**: Ensures that synthesized insights remain traceable to reality, preventing hallucinations from compounding across agent sessions.

## Execution
I will now apply these practices to 3 recent scout knowledge artifacts as part of the pilot.
