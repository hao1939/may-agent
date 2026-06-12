# Pilot: AI-First Knowledge Preamble

Based on the `obsidian-second-brain` pattern of "Notes for AI, not humans", we are piloting an AI-first structure for scout's knowledge files.

## Concept
Knowledge files should begin with a structured preamble designed for LLM consumption, not human readability.

## Preamble Template
```yaml
---
last_updated: YYYY-MM-DD
reliability: [High/Medium/Low - Source dependent]
core_claim: [One sentence summary of the file's primary assertion]
contradicts: [List of files or concepts this might conflict with]
---
# Context for Future Agents
- **Why this exists**: [Brief reason]
- **How to use**: [Actionable instruction for an agent retrieving this]
- **Key entities**: [Comma separated list for keyword matching]
```

## Next Step
Apply this preamble manually to `agents/scout/knowledge/agent-evaluation-trends.md` and measure if it improves retrieval accuracy or synthesis speed in future scout heartbeats.
