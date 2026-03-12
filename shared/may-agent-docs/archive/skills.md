# Skills System

Status: **Superseded** by INDEX.md convention (commit `a91e8a3`)

## What Changed

Skills were previously auto-loaded into the system prompt via `loadSkillsFromDirs()`
and `formatSkillsForPrompt()`. Each agent declared skills in `agent.json`:

```json
{ "skills": ["file-safety", "error-handling", "agent-coordination"] }
```

This injected 3-15KB of skill content per agent into every session prompt.

In V2, skills are **distilled** as 1-2 line summaries in each agent's
`knowledge/INDEX.md`, with references to the full SKILL.md files for
on-demand reading:

```markdown
## Skills (distilled)
- **File safety**: Read before write. Check size before full read.
- **Agent coordination**: call (sync), send (async todo), list, peek, cancel.

## References
- agents/shared/skills/file-safety/SKILL.md — full file safety guide
```

## What Still Exists

- **SKILL.md files** in `agents/shared/skills/` — still exist as reference material
- **`loadSkillsFromDirs()`** and **`formatSkillsForPrompt()`** — still exported from
  `src/lib/skills.ts` and `src/lib/index.ts` for potential external use
- **`parseFrontmatter()`** — still used for YAML frontmatter parsing
- **Per-agent skills directories** (`agents/<name>/skills/`) — no longer auto-loaded

## What Was Removed

- `skills` field from `AgentConfig` (agent.json)
- `skillsDirs` field from `SubagentDefinition`
- `resolveSkillsDirs()` from `agent-loader.ts`
- Auto-loading of skills into system prompt in `resolveSystemPrompt()`
- `<available_skills>` XML block in system prompt

## Original Design

Skills follow the [Agent Skills standard](https://agentskills.io/specification) —
markdown instruction files with YAML frontmatter (name, description) and bundled
scripts/assets. The agent reads instructions and follows them using its existing
tools (read, write, exec).

### SKILL.md Format

```markdown
---
name: brave-search
description: Web search via Brave Search API.
---

# Brave Search

## Usage
\`\`\`bash
./search.js "query"
\`\`\`
```

This format is preserved. Skills still work — agents just need to know where
to find them (via INDEX.md references) rather than having them auto-injected.
