# Agent Folder Layout Conventions

How agent directories are structured, what files go where, and how the runner discovers them.

## Directory Tree

```
agents/
├── <agent-name>/
│   ├── agent.json              # required — agent config (identity, model, tools)
│   ├── knowledge/              # system prompt content
│   │   ├── domain.md           # required — role, responsibilities, instructions
│   │   ├── tools.md            # tool reference specific to this agent (optional)
│   │   ├── coaching.md         # corrections to known failure patterns (optional)
│   │   └── lessons.md          # accumulated lessons (auto-managed by evaluator/optimizer)
│   ├── tools/
│   │   └── INDEX.md            # documents available tools and routing rules
│   ├── workflows/              # workflow definitions (optional)
│   │   └── *.ts                # each file exports execute(ctx): WorkflowResult
│   └── workspace/              # scratch files, progress logs, working artifacts
│       ├── todo.md             # per-agent TODO + tracking list
│       └── journal.md          # agent's own reflections and findings
├── shared/                     # shared knowledge library (not an agent)
│   ├── conventions.md          # detailed workspace/cron/source-tag conventions
│   ├── system-design.md        # conceptual architecture
│   ├── team.md                 # concrete team roster, models, tools, constraints
│   ├── philosophy.md           # Hao's design principles
│   ├── meta-loop.md            # meta-loop process description
│   └── *.md                    # other shared docs
├── README.md                   # repo overview, agent roster
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
    "knowledge/tools.md",
    "knowledge/coaching.md"
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

### Coaching/observation

| Preset | Tools provided | Notes |
|--------|---------------|-------|
| `background-exec` | `background_exec` | Run long-lived background processes (e.g., spawn coachee). Cleaned up on session end. |
| `socket-watch` | `socket_watch` | Watch another agent's socket output in real-time. Cleaned up on session end. |

## knowledge/

Files that form the agent's system prompt. Read fresh at the start of each session (hot-reload — no restart needed).

| File | Purpose | Who maintains it |
|------|---------|------------------|
| `domain.md` | **Required.** Role definition, responsibilities, instructions, rules. | Optimizer, human |
| `tools.md` | Tool reference specific to this agent — how to use its tools, tips, gotchas. | Human, optimizer |
| `coaching.md` | Corrections to known failure patterns. Lessons from coaching sessions. | Coach, human |
| `lessons.md` | Accumulated lessons from real sessions. Added by evaluator/optimizer after reviewing transcripts. | Evaluator, optimizer |

### System prompt assembly order

1. Runtime Environment (project root, workspace path)
2. Identity (name, role, domain, tools, workspace files — auto-injected from definition)
3. Project Structure (directory tree, if enabled)
4. Shared knowledge files (from `sharedKnowledge`, in order)
5. Agent-specific files (from `systemPromptFiles`, in order)
6. Lessons file (auto-appended from `knowledge/lessons.md` if it exists)
7. Skills (from `skills/` dirs)
8. Session Context (session ID)
9. Recent Task History (from memory)
10. Workspace / Output paths
11. Turn Budget (if `maxTurns` is set)

## tools/INDEX.md

Documents the agent's available tools and routing rules. Not machine-read — it's injected into the system prompt so the agent knows what it can do and when to use each tool.

## workflows/

Each `.ts` file exports a workflow function:

```typescript
export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> { ... }
```

Workflows coordinate multi-agent sequences (e.g., coder → QA → retry → escalate). The `workflow` tool preset auto-discovers all `.ts` files in this directory. Workflow name = filename without extension.

## Workspace Conventions

Standard workspace files and their formats. See `agents/shared/conventions.md` for detailed format specs.

### todo.md

Per-agent TODO list. Two sections:

```markdown
# TODO

- [ ] **Task name** — description. Delegate to X if needed.

# Tracking

- [2026-03-05] ✅ Task name — result summary. Evidence: output at path, committed abc1234
- [2026-03-04] ⚠️ Partial task — what worked, what didn't
- [2026-03-03] ❌ Failed task — why it failed
```

**TODO** — actionable work with a finish line. Ordered by priority (top = do first).
Agents drain TODO top-down when they wake up.

**Tracking** — completed items with date and result icon.

#### Completion evidence

Before moving a TODO item to Tracking, the agent must verify completion — not just
assume the work is done because it ran some steps. Check all that apply:

1. **Output file exists** at the expected path (read or stat the file)
2. **Relevant workspace files updated** (todo.md moved to Tracking, journal.md entry written)
3. **Changes committed** if the task produced code or config changes (record the commit hash)

Record evidence inline in the Tracking entry:

```markdown
- [2026-03-05] ✅ Add user validation — Evidence: src/validate.ts exists, 6 tests pass, committed a1b2c3d
- [2026-03-05] ✅ Write exploration report — Evidence: output at workspace/report-2026-03-05.md (142 lines)
- [2026-03-05] ⚠️ Refactor auth module — Evidence: src/auth.ts updated, 2/5 tests fail (see journal)
```

If evidence cannot be confirmed, use ⚠️ (partial) or ❌ (failed) — never ✅.


### [STUCK] Escalation

If an agent tries a task twice and cannot make progress, it should stop and escalate:

1. **Mark the item** — write `[STUCK] reason` next to the TODO item in `workspace/todo.md`
2. **Stop working on it** — do not spin or retry further. Move on to the next item or end the session.
3. **Wait for help** — the next cron cycle or human review will catch it and either provide guidance, context, or reassign the task.

The `[STUCK]` tag is a structured signal, not a failure. It means "I need something I don't have" — more context, a different approach, or human judgment.

Example in todo.md:

```markdown
- [ ] [STUCK] Fix follow-up persistence — JSONL write succeeds but read returns empty, tried flushing and sync, need to check if persistence layer has a race condition
```

After marking, add a brief journal entry explaining what was tried and why it failed.

### journal.md

Per-agent reflection log. Append-only, chronological.

```markdown
## 2026-03-04 — brief description
- What was done
- Key findings
- Next steps
```

The journal captures the agent's own observations — what it tried, what it found,
what surprised it, what it would do differently.

### Optional workspace files

| File | Purpose |
|------|---------|
| `learnings.md` | Self-evolved operational knowledge (edit in place) |
| `inbox.md` | Messages from other agents or the human |

## Cron Conventions

All periodic work runs through **May's `agents/may/cron.json`**. May is the central scheduler — she delegates to the right agent. Individual agents do NOT have their own cron.json.

### Well-Known Cron Patterns

Every agent with ongoing responsibilities should have a **heartbeat** — a periodic wake-up cron job.

#### Heartbeat (drain-todo)

The most common pattern. Wakes the agent to check for work and drain one TODO item.

```json
{
  "name": "<agent>-drain-todo",
  "intervalMs": 28800000,
  "message": "[cron:<agent>-drain-todo] Read agents/<agent>/workspace/todo.md. If there are pending items under # TODO, delegate to <agent> to work on the top item. One item per run.",
  "enabled": true,
  "description": "<Agent> drains its todo.md every 8 hours"
}
```

Typical intervals: 4h (high-priority), 8h (standard), 24h (low-frequency).

#### Exploration

For research/explorer agents. Periodic search and discovery cycles.

```json
{
  "name": "<agent>-explore",
  "intervalMs": 28800000,
  "message": "[cron:<agent>-explore] Delegate to <agent>: Run an exploration cycle. <specific instructions>.",
  "enabled": true,
  "description": "<Agent> explores <domain> every 8 hours"
}
```

#### Review/Audit

For quality-focused agents. Periodic review of recent work.

```json
{
  "name": "<review-name>",
  "intervalMs": 86400000,
  "message": "[cron:<review-name>] Delegate to <agent>: review <what> since last run. Write findings to <output file>.",
  "enabled": true,
  "description": "<Agent> reviews <what> daily"
}
```

### Cron Message Convention

- **Prefix:** `[cron:<job-name>]` — so the agent knows this is automated
- **Be specific:** Include file paths, delegate targets, scope limits
- **One item per run:** Cron jobs should be atomic
- **Source tag:** Cron messages get `source: "cron"` automatically

### Adding a New Cron Job

1. Add the job to `agents/may/cron.json`
2. Use one of the well-known patterns above
3. Include the `[cron:<name>]` prefix in the message
4. Set `enabled: true` (or `false` to stage without firing)
5. Takes effect on next restart or `reload`

## Source Tags

Messages carry a `source` field indicating origin:

| Source | Meaning |
|--------|---------|
| `human` | User typed in terminal or Telegram |
| `human-telegram` | User via Telegram specifically |
| `agent` | Delegated by another agent |
| `cron` | Automated cron job |
| `system` | System-generated (turn warnings, cancellations) |

## Adding a New Agent

1. Create `agents/<name>/agent.json` with required fields
2. Create `agents/<name>/knowledge/domain.md` with role and instructions
3. Optionally add: `knowledge/tools.md`, `knowledge/coaching.md`, `workspace/todo.md`, `workspace/journal.md`
4. Add a heartbeat cron job to `agents/may/cron.json` if the agent has ongoing work
5. Restart the runner (or send `reload` command)

The agent-loader validates config at startup — missing required fields, unknown model keys, unknown tool presets, and missing referenced files all produce errors.

## Naming Conventions

- Agent directory name = `agent.json` `name` field (must match)
- Knowledge files: lowercase, hyphenated (`domain.md`, `lessons.md`, `tools.md`)
- Workflow files: lowercase, hyphenated (`implement-and-review.ts`)
- Workspace files: descriptive, hyphenated (`todo.md`, `journal.md`, `learnings.md`)
- Shared docs: lowercase, hyphenated (`system-design.md`, `team.md`, `philosophy.md`)
