# Cron System

Status: **Implemented**

## Overview

Cron is an opt-in subsystem (`--cron` flag). It runs scheduled jobs for agents:
heartbeat sessions, JS handler functions, and agent task dispatches.

## Key Decisions

### Single cron.json, owned by May
All cron entries live in `agents/may/cron.json`. May is the supervisor and is responsible for maintaining the cron system. Other agents do NOT have the cron tool and cannot modify cron entries.

### Modify via cron tool ONLY
`cron.json` must only be modified via the cron tool — never via bash/edit. The cron tool does safe read-modify-write (reads all entries, modifies one, writes all back). Direct file editing drops entries.

### Handler files live in agents/may/handlers/
Handlers are `.ts` files loaded at runtime from `agents/may/handlers/`. They are NOT compiled into the binary. Keep handlers simple — complex handlers fail silently.

### Critical entries
- `project-resume` — scans active projects every 5 min, forks owners. DO NOT REMOVE.
- `heartbeat-*` — agent heartbeats every 30 min
- `watchdog` — kills stuck sessions every 10 min
- `metrics-snapshot` — measures metrics hourly
- `agents-auto-commit` — syncs agents/ repo

## Entry Types

| Type | How it fires |
|------|-------------|
| `heartbeat` | Sends message to agent, creates a session |
| `job` with `handler` | Runs the handler's JS function |
| `job` with `agent` | Sends message to agent (fallback if handler missing) |

## Per-Agent Cron (not currently used)
The code supports per-agent `cron.json` files at `agents/<name>/cron.json`. Currently only May's is used. If an agent needs their own cron entries, add the `cron` tool to their agent.json.

## Debugging
- Check process health: `may-agent --status` shows which handlers ran
- If a handler doesn't appear in process health, it failed to load (check for runtime errors)
- Keep handlers under 100 lines — complex handlers fail silently
- Test handlers with `bun -e "const m = await import('path'); m.create(mockCtx, entry)"` 

## Health Metric

`system.handler-health` — ratio of critical handlers completing successfully (last hour).
- Owner: May
- Threshold: 0.8 (alert if <80% healthy)
- Measured: auto via metrics-snapshot handler
- Critical handlers tracked: project-resume, watchdog, metrics-snapshot, heartbeat-context, session-sync, standing-orders-check

When this metric drops, May investigates which handler failed and why.
