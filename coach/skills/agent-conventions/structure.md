# Structure Conventions

How agent directories are organized, what files go where, and how the system
discovers and loads them.

## S1: agent.json is Required (Required, All)

Every agent must have `agents/<name>/agent.json`. This is how the runner discovers
agents — it scans `agents/` for directories containing `agent.json`.

Required fields: `name` (must match directory), `description`, `domain`, `model`, `tools`.

Optional fields: `sharedKnowledge`, `memoryLimit`, `delegateDeny`, `systemPromptFiles`.

## S2: UPPERCASE Root Files = Always-Loaded (Required, All)

Files at the agent root in UPPERCASE are auto-loaded into the system prompt:

| File | Purpose | Prompt position |
|------|---------|----------------|
| `SOUL.md` | Identity, personality, mission | Early (after identity block) |
| `DOMAIN.md` | Domain expertise, scope, reference file list | After SOUL |
| `TOOLS.md` | Tool usage guide, patterns, gotchas | After DOMAIN |
| `LESSONS.md` | Accumulated learnings from evaluations | Late (changes often) |

Plus `skills/*/SKILL.md` (auto-discovered) and `sharedKnowledge` from `agents/shared/`.

These files are in the system prompt from turn 1. Agents never need to read them.

## S3: knowledge/ = On-Demand Reference (Required, All)

Files in `knowledge/` are NOT loaded into the prompt. Agents read them via tools
when a task requires detailed reference material.

Good content for knowledge/:
- Detailed methodology docs (coaching-methodology.md)
- Codebase maps and architecture references
- Historical data, regression procedures
- Anything >100 lines that isn't needed every session

Bad content for knowledge/:
- Agent identity (→ SOUL.md)
- Domain overview (→ DOMAIN.md)
- Tool tips (→ TOOLS.md)

## S4: workspace/ = Working Documents (Required, All)

`workspace/` is the agent's scratch space. Standard files:

| File | Purpose | Format |
|------|---------|--------|
| `todo.md` | Pending tasks + completion tracking | Checkbox list + tracking section |
| `journal.md` | Accumulated findings, append-only | Date-headed entries |
| `periodic-tasks.md` | Heartbeat task rotation tracker | Task + last-done date |

Agents may add domain-specific workspace files (reports, session logs, exercise
definitions). Use descriptive hyphenated names.

## S5: skills/ = Auto-Discovered Skills (Required, All)

Each subdirectory under `skills/` with a `SKILL.md` file is auto-discovered and
loaded into the system prompt. The `SKILL.md` must have YAML frontmatter with
at minimum a `description` field.

Other files in the skill directory are reference material — not auto-loaded.
The agent reads them via tools when the skill is relevant.

## S6: DOMAIN.md Lists Reference Files (Recommended, All)

DOMAIN.md should include a section listing what's available in `knowledge/` and
`workspace/` so the agent knows what to read without `ls`:

```markdown
## Reference Files
- `knowledge/library/coaching-methodology.md` — full coaching process
- `workspace/COACHEES.md` — graduation tracking per agent
- `workspace/journal.md` — accumulated findings
```

## S7: UPPERCASE Files Should Be Concise (Recommended, All)

UPPERCASE files are loaded every session into every conversation. Keep them
concise — ideally <100 lines each. The *what* and *why*, not the full *how*.

If a section grows beyond what's needed every turn, extract the detailed
content to `knowledge/` and reference it from DOMAIN.md.

## Full Prompt Assembly Order

For reference — this is what `resolveSystemPrompt()` in `src/manager.ts` builds:

1. Identity block (name, description, domain, tools, workspace files)
2. Project structure (auto-generated directory tree)
3. SOUL.md
4. DOMAIN.md
5. TOOLS.md
6. sharedKnowledge (files from `agents/shared/`)
7. LESSONS.md
8. Skills (from `skills/` dirs)
9. Runtime Environment (project root, agent directory, agent files, workspace path)
10. Session context (session ID)
11. Memory (from `.state/memory/<agent>/`)
