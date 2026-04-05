# Cron System

Status: **Implemented**

## Overview

Cron is an opt-in subsystem (`--cron` flag). It runs scheduled jobs for agents:
heartbeat sessions, JS handler functions, and agent task dispatches.

All cron config lives in `agents/<name>/cron.json`. The agent owns its schedule.

## Instance Architecture

A single `may.ts` process hosts everything:

| Component | When active |
|-----------|-------------|
| Chat session | `--chat` flag |
| Cron timers + handlers | `--cron` flag |
| Telegram bot | `--telegram` flag |
| Socket server | `--socket` flag |
| Console UI | `--console` flag |

Interactive mode (`./may.sh --chat --console --socket`) runs **without** cron.
Production mode adds `--cron --telegram`.

## cron.json Format

```jsonc
[
  {
    "name": "heartbeat",
    "type": "heartbeat",
    "agent": "may",
    "intervalMs": 1200000,
    "message": "[heartbeat] Read agents/may/heartbeat.md...",
    "enabled": true
  },
  {
    "name": "evaluate-sessions",
    "type": "job",
    "intervalMs": 1800000,
    "handler": "evaluate-sessions",
    "enabled": true
  },
  {
    "name": "analyze-failures",
    "type": "job",
    "agent": "bob",
    "intervalMs": 86400000,
    "message": "[cron:analyze-failures] Analyze evaluations...",
    "handler": "run-agent-task",
    "enabled": true
  },
  {
    "name": "heartbeat-bob",
    "type": "job",
    "agent": "bob",
    "intervalMs": 1200000,
    "handler": "heartbeat-precheck",
    "handlerConfig": {
      "agent": "bob",
      "heartbeatMessage": "[heartbeat] Read agents/bob/heartbeat.md..."
    },
    "enabled": true
  }
]
```

## Execution Modes

| Entry type | Handler | What happens |
|-----------|---------|-------------|
| `heartbeat` | — | `followUp` into agent's persistent heartbeat session |
| `job` | `heartbeat-precheck` | JS checks if work exists → dispatches agent task if yes |
| `job` | `run-agent-task` | Spawns agent session: `manager.run(agent, message, { kind: "job" })` |
| `job` | `evaluate-sessions` | JS evaluates unevaluated sessions in-process |
| `job` | `system-status` | JS generates system status report |
| `job` | `daily-brief` | JS generates daily metrics brief |
| `job` | `coaching-report` | JS generates coaching quality report |
| `job` | `watchdog` | JS cancels sessions stuck running > 30min |

## Handler Discovery

Handlers live in `agents/<name>/handlers/` and are auto-discovered by
`loadAgentHandlers()` in `agent-loader.ts`:

```
agents/may/handlers/
  evaluate-sessions.ts
  system-status.ts
  daily-brief.ts
  heartbeat-precheck.ts
  run-agent-task.ts
  coaching-report.ts
  watchdog.ts
```

Each exports a `create(ctx, entry)` factory:

```typescript
import type { HandlerContext } from "../../../src/lib/handler-context.js";

export function create(ctx: HandlerContext, entry: CronEntry): () => Promise<void> {
  return async () => {
    // handler logic using ctx.manager, ctx.persistDir, etc.
  };
}
```

### HandlerContext

```typescript
interface HandlerContext {
  manager: SubagentManager;
  persistDir: string;
  projectRoot: string;
  agentsRoot: string;
  agentName: string;
  notify: (msg: string) => void;  // emit to chat channel (Telegram picks up)
}
```

## Overlap Prevention

If a job is still running when its timer fires again, the fire is skipped.
`Cron.triggerNow()` has a cooldown debounce to prevent rapid re-fires.

## Stale Session Resume

On startup with `--cron`:

```typescript
manager.resumeStaleSessions({ kinds: ["job"] });
```

Only job sessions are resumed. Chat and call sessions are left untouched.
This runs **inside** the `if (CRON_ENABLED)` block — interactive chat mode
never touches stale sessions.

## Event Routing

| Source | Channel |
|--------|---------|
| Chat session | `chat` |
| Heartbeat/job sessions | `activity` |
| Handler notifications (`ctx.notify`) | `chat` |
| Cron system messages | `activity` |

`ctx.notify()` emits on the `chat` channel so Telegram picks it up.

## `send` and Heartbeat Integration

The `agents.message` action:
1. Creates a tracked request in the request DB for the target agent
2. Triggers the target's heartbeat via `triggerNow("heartbeat-{target}")`
3. The heartbeat creates a `kind: "job"` session, agent sees injected pending tasks from DB

## What Changed from V1

| V1 | V2 |
|---|---|
| External crontab + socket commands | Built-in `Cron` class with `cron.json` |
| Handlers hardcoded in `may.ts` | Auto-discovered from `agents/<name>/handlers/` |
| `SCHEDULERS=1` env var | `--cron` flag |
| All sessions treated same on resume | `kinds: ["job"]` filter |
| Notifications via drain queue | `ctx.notify()` emits on chat channel |
