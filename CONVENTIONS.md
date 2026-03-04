# Agent Folder Layout Conventions

How agent directories are structured, what files go where, and how the runner discovers them.

## Directory Tree

```
agents/
├── <agent-name>/
│   ├── agent.json              # required — agent config (identity, model, tools)
│   ├── knowledge/              # system prompt content
│   │   ├── domain.md           # required — role, responsibilities, instructions
│   │   ├── lessons.md          # accumulated lessons (auto-managed by evaluator/optimizer)
│   │   └── codebase.md         # project-specific code knowledge (optional)
│   ├── tools/
│   │   └── INDEX.md            # documents available tools and routing rules
│   ├── workflows/              # workflow definitions (optional)
│   │   └── *.ts                # each file exports execute(ctx): WorkflowResult
│   ├── workspace/              # scratch files, progress logs, working artifacts
│   │   ├── .gitkeep
│   │   └── progress.md         # action log, last output (auto-updated)
│   ├── cron.json               # cron schedule (only if agent has "cron" tool)
│   └── periodic-tasks.md       # describes recurring responsibilities (optional)
├── shared/                     # shared knowledge library (not an agent)
│   ├── system-design.md        # conceptual architecture
│   ├── team.md                 # concrete team roster, models, tools, constraints
│   ├── philosophy.md           # Hao's design principles
│   ├── meta-loop.md            # meta-loop process description
│   └── *.md                    # other shared docs (improvement-plan, design-ideas, etc.)
├── README.md                   # repo overview, agent roster, why separate repo
└── CONVENTIONS.md              # this file
```

## agent.json

The only required file. The runner discovers agents by scanning for `<name>/agent.json`.

```jsonc
{
  "name": "coder",                    // must match directory name
  "description": "Writes code, runs tests — does not commit",
  "domain": "may-agent implementation",
  "model": "opus",                    // key into the runner's models map
  "tools": ["read-write", "exec"],    // tool preset names (see below)

  // Optional fields:
  "systemPromptFiles": [              // paths relative to agent dir, loaded in order
    "knowledge/domain.md",
    "knowledge/codebase.md",
    "tools/INDEX.md"
  ],
  "sharedKnowledge": [                // filenames in shared/, prepended before agent files
    "system-design.md",
    "team.md"
  ],
  "maxTurns": 50,                     // per-session turn limit
  "memoryLimit": 5,                   // compaction: max memory messages to keep
  "delegateDeny": {                   // block direct delegation to specific agents
    "agents": ["coder", "qa"],
    "hint": "Use workflow.run(...) instead."
  }
}
```

### Required fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Agent identifier. Must match the directory name. |
| `description` | string | One-line role summary. |
| `domain` | string | What this agent knows about. |
| `model` | string | Model alias (resolved by the runner's model map). |
| `tools` | string[] | Tool preset names to provision. |

### Optional fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `systemPromptFiles` | string[] | `[]` | Paths to files injected into the system prompt, relative to the agent dir. Loaded in order. |
| `sharedKnowledge` | string[] | `[]` | Filenames from `shared/` prepended to the system prompt before agent-specific files. |
| `maxTurns` | number | runner default | Per-session turn limit. |
| `memoryLimit` | number | — | Compaction threshold: max memory messages to retain. |
| `delegateDeny` | object | — | `{ agents: string[], hint: string }` — blocks delegation to listed agents via the subagents tool, returning `hint` as the error. |

## Tool Presets

Tool presets are string names in `agent.json` `tools` array, mapped to actual tool constructors by the agent-loader.

### File access

| Preset | Tools provided | Notes |
|--------|---------------|-------|
| `read-write` | `read`, `write` | Full file read/write within project root. |
| `read-only` | `read` | Read-only file access. |

### Shell execution

| Preset | Tools provided | Notes |
|--------|---------------|-------|
| `exec` | `exec` | Shell commands. Denies exploration outside project root. |
| `exec-readonly` | `exec` | Shell commands with file-write patterns blocked (`sed -i`, `cat >`, heredocs, `mv`, `cp`, `rm`, etc.). |
| `exec-master` | `exec` | Read-only exec with higher output limit (80K chars). Strips CLI prompt content for deny checking. |

### External CLI agents

| Preset | Tools provided | Notes |
|--------|---------------|-------|
| `claude-code` | `claude_code` | Invoke Claude Code CLI. 80K output limit. |
| `gemini-cli` | `gemini_cli` | Invoke Gemini CLI. 80K output limit. |

### Coordination

| Preset | Tools provided | Notes |
|--------|---------------|-------|
| `subagents` | `subagents` | Delegate tasks to other agents. Respects `delegateDeny` config. |
| `workflow` | `workflow` | Run multi-step workflows from the agent's `workflows/` dir. |
| `cron` | `cron` | Manage recurring tasks. Reads/writes `cron.json` in agent dir. |

### Coaching/observation

| Preset | Tools provided | Notes |
|--------|---------------|-------|
| `background-exec` | `background_exec` | Run long-lived background processes (e.g., spawn coachee). Cleaned up on session end. |
| `socket-watch` | `socket_watch` | Watch another agent's socket output in real-time. Cleaned up on session end. |

## knowledge/

Files that form the agent's system prompt. Read fresh at the start of each session (hot-reload — no restart needed).

| File | Purpose | Who maintains it |
|------|---------|------------------|
| `domain.md` | **Required.** Role definition, responsibilities, instructions, rules. The core of what the agent "is." | Optimizer, human |
| `lessons.md` | Accumulated lessons from real sessions. Added by evaluator/optimizer after reviewing transcripts. | Evaluator, optimizer |
| `codebase.md` | Project-specific code knowledge — architecture, key files, patterns. Only for agents that touch code. | Optimizer, human |

### System prompt assembly order

1. Shared knowledge files (from `sharedKnowledge`, in order)
2. Agent-specific files (from `systemPromptFiles`, in order)
3. Lessons file (auto-appended from `knowledge/lessons.md` if it exists)

## tools/INDEX.md

Documents the agent's available tools and routing rules. Not machine-read — it's injected into the system prompt so the agent knows what it can do and when to use each tool.

## workflows/

Each `.ts` file exports a workflow function:

```typescript
export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> { ... }
```

Workflows coordinate multi-agent sequences (e.g., coder → QA → retry → escalate). The `workflow` tool preset auto-discovers all `.ts` files in this directory. Workflow name = filename without extension.

## workspace/

Scratch directory for the agent's working files. Used for:
- Progress logs (`progress.md`)
- Analysis outputs, briefs, reports
- Exercise materials (coach)
- Session transcripts

Convention: include a `.gitkeep` so the directory exists in git even when empty. Workspace files are generally committed but are ephemeral working artifacts, not core configuration.

## cron.json

Only present for agents with the `cron` tool preset. Array of scheduled tasks:

```json
[
  {
    "name": "daily-review",
    "intervalMs": 86400000,
    "message": "[cron:daily-review] Check improvement-plan.md for TODO items."
  }
]
```

Each entry fires `message` as input to the agent's session at the given interval. Cron jobs only run when `SCHEDULERS=1` environment variable is set.

## periodic-tasks.md

Human-readable description of the agent's recurring responsibilities. Not machine-read — serves as documentation for what the agent should do when idle or on a schedule.

## shared/

Not an agent directory. Contains knowledge documents shared across multiple agents via `sharedKnowledge` in `agent.json`. Owned by the optimizer.

Any agent can reference shared docs, but only agents that list them in `sharedKnowledge` get them injected into their system prompt. Other agents can still read them via filesystem when needed.

## Adding a New Agent

1. Create `agents/<name>/agent.json` with required fields
2. Create `agents/<name>/knowledge/domain.md` with role and instructions
3. Optionally add: `tools/INDEX.md`, `workflows/`, `workspace/.gitkeep`, `knowledge/lessons.md`
4. Restart the runner (or send `reload_agents` command via socket)

The agent-loader validates config at startup — missing required fields, unknown model keys, unknown tool presets, and missing referenced files all produce errors.

## Naming Conventions

- Agent directory name = `agent.json` `name` field (must match)
- Knowledge files: lowercase, hyphenated (`domain.md`, `lessons.md`, `codebase.md`)
- Workflow files: lowercase, hyphenated (`implement-and-review.ts`, `design-review.ts`)
- Workspace files: descriptive, hyphenated (`progress.md`, `latest-analysis.md`, `optimizer-brief.md`)
- Shared docs: lowercase, hyphenated (`system-design.md`, `team.md`, `philosophy.md`)
