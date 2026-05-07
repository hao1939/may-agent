# Heartbeat System

## Overview

Every agent wakes up periodically via a **heartbeat**. A heartbeat is a
cron-triggered reassessment of the agent's standing self-maintenance context:
identity, learned context, inbox, owned metrics, alerts, and active projects.
It is not a separate work mode; it uses the same model as projects, metrics, and
events: signals arrive, the agent judges, then acts or records why no action is
needed.

## Data Flow

```
Cron tick → heartbeat workflow → loads agent context/signals → runs agent session → agent judges/acts
```

## What Gets Loaded

The heartbeat workflow (`agents/shared/workflows/heartbeat-data.ts`) loads:

1. **Metrics** — owned metrics with current values, breaches, trends
2. **Projects** — active projects with status, milestones, last activity
3. **Alerts** — metric alerts requiring attention
4. **Inbox** — recent events (time-window, last 2h) targeted at this agent

All injected into the agent's task prompt as structured sections. Routine
self-maintenance uses this implicit agent project. Durable multi-session goals
found during heartbeat should be created or updated as shared projects.

## Per-Agent Workflows

Each agent has a heartbeat workflow at `agents/<name>/workflows/<name>-heartbeat.ts`:
- Imports shared data loaders
- Builds the task prompt with loaded context
- Calls `sdk.runAgent()` with the agent name and assembled task

## Auto-Generation

Agents don't need explicit cron.json entries for heartbeats:
- `generateAutoHeartbeats()` scans agents with heartbeat workflows
- Creates synthetic cron entries with hash-based offsets
- Explicit cron.json entries override (name dedup)
- Opt-out: `"heartbeat": false` in agent.json

## Heartbeat.md (per-agent)

Each agent can have `agents/<name>/heartbeat.md` — role-specific guidance read
during heartbeat. It should describe recurring inspection and judgment duties,
not carry long-term project memory. Not in the system prompt — only loaded when
the heartbeat fires.

## Implementation

- **Shared loaders:** `agents/shared/workflows/heartbeat-data.ts`
- **Auto-generation:** `src/app/agent-loader.ts` → `generateAutoHeartbeats()`
- **Per-agent workflows:** `agents/<name>/workflows/<name>-heartbeat.ts`
