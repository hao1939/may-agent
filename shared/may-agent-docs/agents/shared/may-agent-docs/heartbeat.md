# Heartbeat System

## Overview

Every agent wakes up periodically via a heartbeat — a cron-triggered workflow that gives the agent context and lets it decide what to do.

## Data Flow

```
Cron tick → heartbeat handler → loads context → runs agent session → agent acts
```

## What Gets Loaded

`agents/shared/workflows/heartbeat-data.ts` loads:

1. **Metrics** — owned metrics with values, breaches, trends
2. **Projects** — active projects with status, milestones, activity
3. **Alerts** — metric alerts requiring attention
4. **Inbox** — recent events (last 2h) targeted at this agent

All injected into the agent's task prompt.

## Per-Agent Workflows

Each agent: `agents/<name>/workflows/<name>-heartbeat.ts`
- Imports shared data loaders
- Builds task prompt with loaded context
- Calls `sdk.runAgent()` with agent name + assembled task

## Auto-Generation

- `generateAutoHeartbeats()` scans agents with heartbeat workflows
- Creates synthetic cron entries with hash-based offsets
- Explicit cron.json entries override
- Opt-out: `"heartbeat": false` in agent.json

## Heartbeat.md

`agents/<name>/heartbeat.md` — role-specific guidance, read only during heartbeat (not in system prompt).

## Implementation

- **Shared loaders:** `agents/shared/workflows/heartbeat-data.ts`
- **Auto-generation:** `src/app/agent-loader.ts`
- **Per-agent:** `agents/<name>/workflows/<name>-heartbeat.ts`
