# Agent Directory Convention

## Directory Layout

```
agents/<name>/
  agent.json              # Required. Operational config (model, tools, limits).
  cron.json               # Optional. Cron job definitions.
  heartbeat.md            # Optional. Read by agent during heartbeat (not in prompt).

  SOUL.md                 # Convention file. Identity, mission, values.
  DOMAIN.md               # Convention file. Domain expertise.
  TOOLS.md                # Convention file. Tool usage guide.
  LESSONS.md              # Convention file. Accumulated learnings.

  knowledge/              # On-demand reference material.
    INDEX.md              # Convention file. Curated context, references, skills.
    *.md                  # Referenced from INDEX.md, read on demand.

  workspace/              # Ephemeral scratch (gitignored, not in prompt).
    *.md                  # Working documents (journal, notes, etc.).

  handlers/               # JS cron handlers (optional).
  workflows/              # Workflow definitions (optional).

agents/shared/            # Shared reference material (read on demand, not auto-loaded).
  team.md                 # Team roster and roles.
  philosophy.md           # Design philosophy.
  best-practices.md       # Engineering practices.
  skills/                 # Skill guides (full versions, read on demand).
    file-safety/SKILL.md
    agent-coordination/SKILL.md
    ...
```

## Convention Files

Five files auto-loaded into the system prompt by naming convention. No config needed.
Missing files are silently skipped.

| File | Location | Purpose | Prompt Order |
|------|----------|---------|-------------|
| `SOUL.md` | `agents/<name>/SOUL.md` | Identity, mission, personality, values | 1st |
| `DOMAIN.md` | `agents/<name>/DOMAIN.md` | Domain expertise, scope, boundaries | 2nd |
| `TOOLS.md` | `agents/<name>/TOOLS.md` | Tool usage patterns and guidelines | 3rd |
| `LESSONS.md` | `agents/<name>/LESSONS.md` | Accumulated learnings from experience | 4th |
| `INDEX.md` | `agents/<name>/knowledge/INDEX.md` | Curated context: team, skills, project layout, references | 5th |

Plus two generated sections:
- **Runtime Environment** (6th) — project root, paths, workspace, list of convention files already in context
- **Session Context** (7th) — session ID, recent task history from memory

### What Goes Where

| Content | File | Reason |
|---------|------|--------|
| "I am Bob, the system architect" | SOUL.md | Identity — who you are |
| "Design principles for may-agent" | DOMAIN.md | Domain — what you know |
| "Use `agents.call` for sync, `message` for async" | TOOLS.md | Tool usage — how to act |
| "Always check git status before committing" | LESSONS.md | Learned from experience |
| "Team: Bob=architect, May=coordinator, ..." | INDEX.md | Curated context |
| "File safety: read before write, check size" | INDEX.md | Distilled skill summary |
| "For full guide: read agents/shared/skills/file-safety/SKILL.md" | INDEX.md | Reference pointer |
| "Key dirs: src/lib/, src/app/, agents/, test/" | INDEX.md | Project structure |
| Detailed scraping methodology (200 lines) | knowledge/*.md | Too large for prompt |
| Todo lists, journals, draft reports | workspace/*.md | Working documents |

### INDEX.md: The Context Hub

INDEX.md replaces three former mechanisms: `sharedKnowledge`, `skills`, and `projectStructure`.
Each agent distills shared knowledge into its own INDEX.md tailored to its role.

Typical structure:

```markdown
# Knowledge Context

## Team
Bob is the architect. May coordinates. Tech-lead implements via coder + QA.
Coach trains agents. Optimizer analyzes performance. Scout and Amy research.

## Design Philosophy (distilled)
- Filesystem is truth. Sessions are ephemeral, knowledge persists.
- Agents own their context. No shared mutable state.
- Sync call for cooperation, async send for todo assignment.

## Skills (distilled)
- **File safety**: Read before write. Check size before full read.
- **Agent coordination**: call (sync), send (async todo), list, peek, cancel.
- **Document collaboration**: Review with `> [Name date]` blockquote comments.

## Project Layout
- src/lib/ — core library (manager.ts, types.ts, tools/)
- src/app/ — application layer (may.ts, agent-loader.ts, cron.ts)
- agents/ — agent configs, knowledge, handlers
- test/ — test files

## Available References
Read on demand when relevant:
- agents/shared/philosophy.md — full design philosophy (24KB)
- agents/shared/best-practices.md — full best practices (24KB)
- agents/shared/skills/ — full skill guides
```

### Two Layers

**Always-loaded (convention files at agent root + knowledge/INDEX.md)**:
These define *who the agent is*. Auto-loaded every session. UPPERCASE signals
"this is in the system prompt automatically."

**On-demand (knowledge/, workspace/, agents/shared/)**:
Read by the agent via file tools when a task needs them. DOMAIN.md should
list what's available so the agent knows what to read.

**Rule of thumb**: If a file is >100 lines, it belongs in `knowledge/` as a
reference, not in a convention file. Convention files should be concise — the
*what* and *why*, not the full *how*.

## agent.json Schema

```jsonc
{
  "name": "coder",                    // Must match directory name
  "description": "Writes code...",    // One-line role summary
  "domain": "may-agent implementation", // Domain of expertise
  "model": "opus",                    // Key into models map
  "tools": ["coding", "agents"],      // Tool presets
  "maxTurns": 30,                     // Optional: turn limit
  "memoryLimit": 20,                  // Optional: memory entries in prompt
  "delegateDeny": {                   // Optional: block delegation
    "agents": ["coder", "qa"],
    "hint": "Use agents.call for direct work instead"
  }
}
```

agent.json is **purely operational**. No prompt-related fields. All prompt
content lives in the 5 convention files.

## System Prompt Assembly

`resolveSystemPrompt()` in `src/lib/manager.ts` (~90 lines):

1. **SOUL.md** — identity, mission, values
2. **DOMAIN.md** — domain expertise
3. **TOOLS.md** — tool usage guide
4. **LESSONS.md** — accumulated learnings
5. **knowledge/INDEX.md** — curated context (team, skills, references)
6. **Runtime Environment** — paths, workspace, loaded files list (generated)
7. **Session Context** — session ID, recent task history from memory (generated)

Stable content first (cache-friendly for LLM prefix caching), volatile last.

If `systemPrompt` is set directly on `SubagentDefinition`, all convention
file loading is bypassed (escape hatch for tests and special cases).

## Adding a New Agent

1. Create `agents/<name>/agent.json` with operational config
2. Create `agents/<name>/SOUL.md` — identity and mission
3. Create `agents/<name>/DOMAIN.md` — domain expertise, reference file list
4. Optionally: `TOOLS.md`, `LESSONS.md`, `knowledge/INDEX.md`
5. Restart or `reload` command

## Common Mistakes

- **Bloated DOMAIN.md** — move detailed methodology to `knowledge/`, keep DOMAIN concise
- **Putting shared files in prompt** — `agents/shared/` is a reference, not auto-loaded. Distill into INDEX.md
- **Missing INDEX.md references** — if knowledge/ has files, list them in INDEX.md so the agent knows to read them
- **workspace/ in git** — workspace is ephemeral scratch, gitignored. knowledge/ is curated, preserved in git
