# Agent Directory Convention

## Directory Layout

```
agents/<name>/
  agent.json              # Required. Operational config: model, tools, limits.
  AGENTS.md               # Required. Identity and stable operating contract.
  heartbeat.md            # Historical convention; loaded only by an explicit App consumer.
  cron.json               # Optional. Cron job definitions (top-level JSON array).
                          # Requires `"cron"` in agent.json tools[]; otherwise ignored.

  knowledge/              # On-demand reference material.
    INDEX.md              # Routing table for references.
    *.md                  # Domain docs, playbooks, long-form knowledge.

  workspace/              # Scratch/runtime work, not system prompt.
    *.md

  skills/                 # Reusable situational procedures.
    <name>/SKILL.md        # Canonical package; not always loaded.
    <name>/references/     # Optional progressive-disclosure detail.
    <name>/scripts/        # Optional; prefer TypeScript/JavaScript + Bun.

  handlers/               # JS cron/event handlers.
  workflows/              # Executable TypeScript orchestration.
    <name>.ts              # Canonical flat workflow entrypoint.
  last-session.md         # Generated runtime memory, not system prompt.

projects/<id>.app/agents/<name>/
  agent.json              # Same shape; agent is scoped to the App.
  AGENTS.md
  skills/<name>/SKILL.md
  workspace/

shared/
  common-sense.md         # Shared always-loaded behavioral fundamentals.
  knowledge/              # Shared references, read on demand.
  skills/<name>/SKILL.md  # Fleet-wide reusable procedures.

projects/may-agent.app/docs/
  ...                     # May and Host architecture, design, and operator docs.
```

## Prompt Files

Only two authored files are always loaded into the normal system prompt:

| File                      | Purpose                                                         | Loaded                |
| ------------------------- | --------------------------------------------------------------- | --------------------- |
| `shared/common-sense.md`  | Shared behavioral fundamentals and repo conventions             | Every agent session   |
| `agents/<name>/AGENTS.md` | Agent identity, responsibility, constraints, escalation posture | That agent's sessions |

Everything else is discoverable context. `context.md`, `DOMAIN.md`, `TOOLS.md`,
`LESSONS.md`, `knowledge/INDEX.md`, `heartbeat.md`, `last-session.md`, and
`workspace/*` are not automatically loaded into the system prompt. Link useful
files from `AGENTS.md`, a scoped skill, or the Task's exact references so the
agent can read them when relevant. If particular bytes are required for a
judgment, the owning workflow supplies them in the task brief or uses the
existing `contextPreparation` hook. A configured path is not evidence that its
contents reached the model.

Agent definitions no longer declare `context_files`; older JSON containing it
remains readable, without injecting those files. Separately, an `agents` tool
call can supply `context_files` as explicit paths for its recipient to read.
These links are supporting context, not another instruction tier.

Canonical skills live in named directories with `SKILL.md`; loose Markdown
files under `skills/` are legacy. Native metadata discovery, bounded catalogs,
and per-turn invocation are implemented as specified in
[skills.md](../2a-design/skills.md). Callers may explicitly select one primary
skill, while model-driven activation is evidenced by a successful full-file
read.

Skills and workflows share scoped discovery conventions but not execution.
Skills are interpreted per-turn guidance; workflow TypeScript controls one
bounded ordered run. Durable waits end that run and resume through a later
event. See [workflows.md](../2a-design/workflows.md).

## What Goes Where

| Content                                            | Location                 | Reason                      |
| -------------------------------------------------- | ------------------------ | --------------------------- |
| "I am Bob, the system architect"                   | `AGENTS.md`              | Stable identity             |
| "Own architecture tradeoffs and escalation briefs" | `AGENTS.md`              | Durable responsibility      |
| "Use evidence before changing evaluation criteria" | `AGENTS.md`              | Always-on constraint        |
| "Long metric debugging recipe"                     | `knowledge/*.md`         | Situational reference       |
| "Read X when handling Y"                           | `knowledge/INDEX.md`     | Discovery routing           |
| "Use this procedure when task X appears"           | `skills/<name>/SKILL.md` | Situational reusable method |
| Periodic review method                            | App-owned skill/workflow | Selected by ordinary App input; no special heartbeat loader |
| Recent notes, drafts, temporary plans              | `workspace/`             | Runtime scratch             |
| Generated session continuity                       | `last-session.md`        | Runtime/session context     |

If a lesson must affect every session, promote the distilled invariant into
`AGENTS.md`. If it is situational, keep it in `knowledge/` and
link it from `knowledge/INDEX.md`.

### Reporting is not adoption

`finish()` reports the current turn. Its `completed_items` and `new_items` do
not complete or create Tasks/Requests; use the owning App's authorized controls.
`context_updates` reports suggestions, not an activated preference. The legacy
context-writing subscriber is retired, and even a written
`context.md` is not automatically included in a normal prompt. `lessons` attempts
a best-effort local memory-stream append, not automatic retrieval or learning.

For lasting behavior, use an authorized source edit in the owning guidance,
verify activation, then check a later relevant execution. A saved report or
file alone does not prove May will use it. Follow the existing
[learning review boundary](../2a-design/practice-learning-loop.md) and the
[scoped teaching proposal](../proposals/agent-behavior-and-capability-extension.md);
this does not grant permission to change live guidance. See
[skill snapshots](../2a-design/skills.md#discovery-lifecycle) for when an updated
definition takes effect.

Distinguish released references from mutable operational evidence. A knowledge
file inside a definition release stays with that snapshot; a live fact changes
when its tool reads the current owned source. Keep source/freshness clear.
Restart restores the active definition, not unactivated edits. Temporary input
or a selected skill may remain in history without becoming standing guidance.
The [method matrix](../proposals/extension-methods-poc-20260912.md)
explains the selection, activation and retention tradeoffs.

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

`resolveSystemPrompt()` in `projects/may-agent/src/lib/agent-execution.ts` builds:

1. `shared/common-sense.md`
2. the registered agent's `AGENTS.md` (global or app-local)
3. bounded skill metadata when the toolset can read skill files
4. generated runtime facts: project root, agent directory, workspace,
   knowledge path, and available tools

If `systemPrompt` is set directly on `SubagentDefinition`, convention-file
assembly is bypassed. That escape hatch is for tests and special runtime
sessions, not normal agent configuration.

## agent.json

`agent.json` is operational only:

```jsonc
{
  "name": "dev",
  "description": "Investigates runtime failures and returns verified fixes",
  "domain": "may-agent implementation",
  "model": "claude-opus-5",
  "tools": ["coding", "agents", "finish"],
  "compaction": true,
}
```

Do not put prose instructions in `agent.json`.
`memoryLimit` is a retained compatibility field with no effect on current
system-prompt assembly; omit it from new configurations.

Omit retired `context_files` and `skillActivationRules` configuration. Link
supporting context from identity, skills or Task references; skill selection
uses the catalog and explicit `skill` argument.

Skills are convention-discovered rather than enumerated in `agent.json`.
Operational enable/disable policy may be added later without moving skill
instructions into configuration.

## Adding a New Agent

1. Create `agents/<name>/agent.json`.
2. Create `agents/<name>/AGENTS.md`.
3. Optionally create `heartbeat.md`, `knowledge/INDEX.md`, `knowledge/*.md`,
   `skills/<name>/SKILL.md`, handlers, or workflows.
4. Restart or use the runtime reload command.

For an Agent-App-scoped agent, use the same shape under
`projects/<id>.app/agents/<name>/`. Wire project-specific automation from the
app's `app.ts` schedules and workflow handlers, not from a separate
project-local cron file. Use this for project-specific automation, not shared
platform policy.

## Common Mistakes

- **Prompt bloat:** Put long methodology in `knowledge/`, not `AGENTS.md`.
- **Hidden auto-load assumptions:** Files are not prompt just because they are uppercase.
- **Lessons as a dump:** Distill durable lessons before promoting them into `AGENTS.md`.
- **Workspace as memory:** `workspace/` is scratch. Curated knowledge belongs in `knowledge/`.
