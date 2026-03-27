# LLM Call Structure

## Overview

When a session runs, the LLM receives:

```
┌──────────────────────────────────────────────────────────┐
│                     SYSTEM PROMPT                         │
│  (cached across sessions — same for every session of      │
│   the same agent)                                         │
│                                                           │
│  1. SOUL.md — identity, mission, values                   │
│  2. DOMAIN.md — domain expertise                          │
│  3. TOOLS.md — tool usage guide                           │
│  4. shared/LESSONS.md — team-wide learnings               │
│  5. <agent>/LESSONS.md — agent-specific learnings         │
│  6. knowledge/INDEX.md — curated references               │
│  7. shared/INDEX.md — team knowledge index                │
│  8. shared/common-sense.md — behavioral fundamentals      │
│  9. Runtime Environment (paths, workspace, loaded files)  │
│ 10. Available Tools (list of tool names)                  │
│                                                           │
│  Wrapped in <system_instructions>...</system_instructions> │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│               FIRST USER MESSAGE                          │
│  (changes per session — not cached)                       │
│                                                           │
│  Session Context:                                         │
│    - Session ID, current time                             │
│    - Recent Task History (from memory JSONL, up to 20)    │
│    - Active Recall warnings (from ERROR_LOG patterns)     │
│    - Last Checkpoint (if resuming work)                   │
│    - context_files (e.g., conversation-state.md)          │
│                                                           │
│  ---                                                      │
│                                                           │
│  Task:                                                    │
│    The actual task text (human message, cron heartbeat,   │
│    delegation from another agent)                         │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│              CONVERSATION HISTORY                         │
│  (grows during session, compacted when too large)         │
│                                                           │
│  [assistant] Agent's response                             │
│  [tool_call] Agent calls a tool                           │
│  [tool_result] Tool returns result                        │
│  [assistant] Agent continues...                           │
│  ... (repeats for each turn)                              │
│                                                           │
│  When tokens exceed ~70% of context window:               │
│    → Compaction: old messages summarized structurally      │
│    → Original task + key facts preserved                  │
│    → Most recent reasoning block preserved                │
└──────────────────────────────────────────────────────────┘
```

## Data sources

### System Prompt (stable per agent, cached)

| Section | Source file | Purpose | Typical size |
|---------|-----------|---------|-------------|
| SOUL.md | `agents/<name>/SOUL.md` | Identity, mission, behavioral rules | 1-3 KB |
| DOMAIN.md | `agents/<name>/DOMAIN.md` | Domain expertise | 0.5-2 KB |
| TOOLS.md | `agents/<name>/TOOLS.md` | Tool usage guide, examples | 1-4 KB |
| shared/LESSONS.md | `agents/shared/LESSONS.md` | Team-wide learnings | 1-3 KB |
| LESSONS.md | `agents/<name>/LESSONS.md` | Agent-specific learnings | 0.5-3 KB |
| INDEX.md | `agents/<name>/knowledge/INDEX.md` | Curated refs, skill pointers | 1-3 KB |
| shared/INDEX.md | `agents/shared/INDEX.md` | Team knowledge index | 0.5-1 KB |
| common-sense.md | `agents/shared/common-sense.md` | Behavioral fundamentals | 3-5 KB |
| Runtime env | Generated | Paths, workspace, loaded files | 0.3 KB |
| Available tools | Generated | Tool name list | 0.1 KB |

**Total system prompt: ~10-25 KB** depending on agent.

### Session Context (first user message, changes per session)

| Section | Source | Purpose |
|---------|--------|---------|
| Session ID + time | Generated | Session identity |
| Recent Task History | `.state/memory/<agent>.jsonl` | Last N session summaries (task, status, duration, key outcomes) |
| Active Recall | `agents/<name>/workspace/ERROR_LOG.jsonl` | Warnings about past failure patterns |
| Last Checkpoint | `.state/checkpoints/` | Resume point from previous session |
| context_files | `agents/<name>/<files>` | Agent-specific volatile context (e.g., conversation-state.md) |

### Task

The actual work request. Comes from:
- Human typing in chat/telegram/web
- Cron heartbeat message (from `cron.json`)
- Agent delegation via `agents({ action: "call" })`
- Workflow step

### Conversation History

Grows during the session. Each turn adds:
- Assistant message (LLM response, including thinking)
- Tool calls (name, arguments)
- Tool results (output text, error flag)

Managed by pi-agent-core's `Agent` class. May-agent adds:
- **Compaction**: When tokens > ~70% of context window, old messages are structurally summarized (no LLM call, fast and deterministic). Preserves: original task, key facts (files read/written, commands run), most recent reasoning.
- **Overflow recovery**: When context window is hit hard, extract progress into a handoff document for a new session.
- **Tool result enrichment**: OpBudget status injected when >50% consumed. Stuck warnings injected on consecutive errors.

## Agent configuration (from agent.json)

```json
{
  "name": "optimizer",
  "opBudget": 60,
  "memoryLimit": 20,
  "description": "Analyzes agent performance, proposes improvements",
  "domain": "agent system optimization",
  "model": "opus",
  "compaction": true,
  "tools": ["coding", "agents", "workflow", "checkpoint", "finish"],
  "contextFiles": []
}
```

| Field | Effect on LLM call |
|-------|-------------------|
| `model` | Which LLM to call (mapped to actual model ID + API in may.ts) |
| `opBudget` | Injected into tool results when >50% consumed; session stopped when exceeded |
| `memoryLimit` | How many past session summaries to include in first user message |
| `compaction` | Whether to enable context compaction for long sessions |
| `tools` | Which tools the agent can call (mapped to tool presets in agent-loader.ts) |
| `contextFiles` | Extra files loaded into first user message |

## What the LLM DOESN'T see

- Other agents' sessions or transcripts (unless explicitly read via tools)
- The raw SQLite database
- The EventBus or socket events
- Other agents' system prompts
- The manager's internal state (active sessions, cron schedule)
- Git history or diffs (unless read via bash)
