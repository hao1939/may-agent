# Infra Metrics Design

## Existing
| Metric | Type | What it measures | Status |
|--------|------|-----------------|--------|
| system.handler-health | health | % critical handlers running | ✅ New |
| system.stuck-requests | health | Requests with no progress | ✅ Working |
| system.request-throughput | health | Requests processed per day | ✅ Working |
| system.agent-utilization | continuous | Agents producing work | ✅ Working |

## Proposed — one metric per infra component

| Metric | Type | Owner | Measures | Source |
|--------|------|-------|----------|--------|
| **system.session-success-rate** | health | may | % sessions ending in done (not error/interrupted) last 24h | auto: SQL |
| **system.project-velocity** | health | may | Active projects that made progress (file modified) in last 24h | auto: SQL + filesystem |
| **system.sync-freshness** | health | may | Hours since last successful agents-auto-commit | auto: SQL on requests table |
| **system.db-health** | health | may | WAL file size — alerts if too large (>100MB) | command: `stat .state/may.db-wal` |
| **system.uptime** | health | may | Minutes since process started — alerts if recently restarted (<10min = crash recovery) | command: `ps -o etimes= -p 1` |

## Why these 5

Each maps to an infra failure we've actually experienced:

1. **session-success-rate** — We've seen agents crash, get stuck, context overflow. This catches systemic session failures.
2. **project-velocity** — Projects stall silently. This catches "active but not moving."
3. **sync-freshness** — agents-auto-commit stopped for 2+ hours multiple times. This catches sync failures.
4. **db-health** — WAL file grew to 95MB earlier. Schema mismatches crash the process. This catches DB issues.
5. **uptime** — The process crashed and supervisor didn't restart. This catches process-level failures.

## What we DON'T track (and why)

- **Telegram/web/socket liveness** — low priority, these are interfaces not core infra. If the process is up, interfaces are up.
- **Individual handler error rates** — handler-health covers this as an aggregate. Individual tracking is too granular.
- **Context window usage** — the compaction system handles this automatically.

## All metrics owned by May
May is the supervisor. All infra metrics are hers. She watches, investigates, escalates to Hao when something is broken.
