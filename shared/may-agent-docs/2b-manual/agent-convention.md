# Agent Directory Convention

## Directory Layout

```
agents/<name>/
  agent.json              # Required. Operational config: model, tools, limits.
  AGENTS.md               # Required. Identity and stable operating contract.
  heartbeat.md            # Optional. Heartbeat-only guidance, not system prompt.
  cron.json               # Optional. Cron job definitions (top-level JSON array).
                          # Requires `"cron"` in agent.json tools[]; otherwise ignored.

  knowledge/              # On-demand reference material.
    INDEX.md              # Routing table for references.
    *.md                  # Domain docs, playbooks, long-form knowledge.

  workspace/              # Scratch/runtime work, not system prompt.
    *.md

  handlers/               # JS cron/event handlers.
  workflows/              # Workflow definitions.
  last-session.md         # Generated runtime memory, not system prompt.

shared/
  common-sense.md         # Shared always-loaded behavioral fundamentals.
  knowledge/              # Shared references, read on demand.
  may-agent-docs/         # Architecture and operator docs.
```

## Prompt Files

Only two authored files are always loaded into the v2 system prompt:

| File | Purpose | Loaded |
|------|---------|--------|
| `shared/common-sense.md` | Shared behavioral fundamentals and repo conventions | Every agent session |
| `agents/<name>/AGENTS.md` | Agent identity, responsibility, constraints, escalation posture | That agent's sessions |

Everything else is discoverable context. `DOMAIN.md`, `TOOLS.md`, `LESSONS.md`,
`knowledge/INDEX.md`, `heartbeat.md`, `last-session.md`, and
`workspace/*` are not automatically loaded into the system prompt.

## What Goes Where

| Content | Location | Reason |
|---------|----------|--------|
| "I am Bob, the system architect" | `AGENTS.md` | Stable identity |
| "Own architecture tradeoffs and escalation briefs" | `AGENTS.md` | Durable responsibility |
| "Use evidence before changing evaluation criteria" | `AGENTS.md` | Always-on constraint |
| "Long metric debugging recipe" | `knowledge/*.md` | Situational reference |
| "Read X when handling Y" | `knowledge/INDEX.md` | Discovery routing |
| Heartbeat investigation prompts | `heartbeat.md` | Heartbeat workflow only |
| Recent notes, drafts, temporary plans | `workspace/` | Runtime scratch |
| Generated session continuity | `last-session.md` | Runtime/session context |

If a lesson must affect every session, promote the distilled invariant into
`AGENTS.md`. If it is situational, keep it in `knowledge/` and
link it from `knowledge/INDEX.md`.

## AGENTS.md Shape

Keep `AGENTS.md` concise and durable:

```markdown
# AGENTS — <Name>

## Identity
Who this agent is.

## Responsibility
What this agent owns and is accountable for.

## Operating Model
How it approaches work.

## Delegation and Escalation
Who it should involve and when.

## Constraints
Stable rules that must apply every session.

## References
Pointers to knowledge files, not copied knowledge.
```

`AGENTS.md` is also the pi-coding-agent-compatible file name. Running pi from
inside an agent directory can pick up that agent's instructions without May
needing a May-specific identity filename.

## System Prompt Assembly

`resolveSystemPrompt()` in `src/lib/manager.ts` builds:

1. `shared/common-sense.md`
2. `agents/<name>/AGENTS.md`
3. generated runtime facts: project root, agent directory, workspace, knowledge path, available tools

If `systemPrompt` is set directly on `SubagentDefinition`, convention-file
assembly is bypassed. That escape hatch is for tests and special runtime
sessions, not normal agent configuration.

## agent.json

`agent.json` is operational only:

```jsonc
{
  "name": "coder",
  "description": "Writes code and returns verified patches",
  "domain": "may-agent implementation",
  "model": "opus",
  "tools": ["coding", "agents", "finish"],
  "memoryLimit": 20,
  "compaction": true
}
```

Do not put prose instructions in `agent.json`.

## Adding a New Agent

1. Create `agents/<name>/agent.json`.
2. Create `agents/<name>/AGENTS.md`.
3. Optionally create `heartbeat.md`, `knowledge/INDEX.md`, `knowledge/*.md`, handlers, or workflows.
4. Restart or use the runtime reload command.

## Common Mistakes

- **Prompt bloat:** Put long methodology in `knowledge/`, not `AGENTS.md`.
- **Hidden auto-load assumptions:** Files are not prompt just because they are uppercase.
- **Lessons as a dump:** Distill durable lessons before promoting them into `AGENTS.md`.
- **Workspace as memory:** `workspace/` is scratch. Curated knowledge belongs in `knowledge/`.
