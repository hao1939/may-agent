# DESIGN: Metrics System

**Status:** DRAFT — awaiting Hao review  
**Date:** 2026-04-15  
**Author:** May (with Hao)  
**Replaces:** `shared/protocols/metrics-framework.md` (383-line aspirational doc, never implemented)

---

## Problem

We have **rich raw data** in `may.db` (22K evaluations, 22K sessions, 28K requests, 77K convention checks, 1.4K gym runs) — but no way to:
1. See what's happening **over time** (is quality trending up? is cost growing?)
2. Detect **anomalies** automatically (cost spike, quality drop, error storm)
3. Answer "how's the system doing?" without someone running ad-hoc SQL

The old metrics-framework.md wanted 4 agents to each write weekly reports. Nobody did it. The data sat there unused.

## Insight

This is an **infrastructure** problem, not an agent-behavior problem. Metrics need to be:
- **Computed automatically** (no agent writes a report)
- **Stored as time-series** (so trends are visible, not just point-in-time)
- **Queryable** (any agent or human can ask "show me quality trends for bob")
- **Extensible** (add new metrics without code changes — just a new SQL query + a name)

## Architecture

```
Raw data (sessions, evaluations, requests, gym_runs, ...)
          │
          ▼
┌──────────────────────────┐
│   metrics-snapshot.ts    │  ← JS handler, runs on cron (every 1h)
│   (compute & store)      │
│                          │
│   For each metric:       │
│   1. Run SQL query       │
│   2. Write row to        │
│      `metric_snapshots`  │
│      table               │
└──────────────────────────┘
          │
          ▼
┌──────────────────────────┐
│  metric_snapshots table  │  ← Time-series storage
│                          │
│  metric_name  TEXT       │  e.g. "quality.bob", "cost.daily.total"
│  value        REAL       │  e.g. 0.86, 42.50
│  dimensions   TEXT (JSON)│  e.g. {"agent":"bob"} — for filtering
│  window       TEXT       │  e.g. "1h", "24h", "7d" — what time range the value covers
│  computed_at  INTEGER    │  epoch ms when this snapshot was taken
└──────────────────────────┘
          │
          ▼
┌──────────────────────────┐
│  Consumers               │
│                          │
│  • system_status tool    │  ← Already exists. Add metrics summary.
│  • May's digest          │  ← Proof-of-life digests pull from snapshots
│  • Telegram alerts       │  ← Threshold breach → immediate notify
│  • Any agent query       │  ← "SELECT * FROM metric_snapshots WHERE..."
│  • Web console (future)  │
└──────────────────────────┘
```

## What We Track (Phase 1 — the essentials)

### Cost
| Metric Name | Query | Window |
|-------------|-------|--------|
| `cost.daily.total` | SUM(usage→cost) from evaluations in last 24h | 24h |
| `cost.daily.{agent}` | Same, per agent | 24h |
| `cost.heartbeat_pct` | Heartbeat sessions cost / total cost | 24h |

### Quality  
| Metric Name | Query | Window |
|-------------|-------|--------|
| `quality.avg.{agent}` | AVG(quality) from evaluations in last 24h | 24h |
| `quality.avg.system` | AVG(quality) across all agents | 24h |
| `quality.fm_rate.{agent}` | Sessions with needs_improvement / total | 24h |

### Health
| Metric Name | Query | Window |
|-------------|-------|--------|
| `health.error_rate.{agent}` | Error sessions / total sessions | 24h |
| `health.error_rate.system` | System-wide error rate | 24h |
| `health.request_backlog` | COUNT of requests with status CREATED/IN_PROGRESS older than 30min | point-in-time |
| `health.stuck_sessions` | Sessions running > 10min | point-in-time |

### Throughput
| Metric Name | Query | Window |
|-------------|-------|--------|
| `flow.requests.completed` | COUNT completed requests | 24h |
| `flow.requests.failed` | COUNT failed requests | 24h |
| `flow.avg_duration.{agent}` | AVG request duration per agent | 24h |
| `flow.sessions.total` | COUNT sessions started | 24h |

### Research (from existing knowledge tables)
| Metric Name | Query | Window |
|-------------|-------|--------|
| `research.knowledge_entries` | COUNT from knowledge_entries | total |
| `research.hypotheses.active` | COUNT hypotheses WHERE status LIKE '%Active%' or '%ACTIVE%' | total |
| `research.experiments.completed` | COUNT experiments WHERE status = 'completed' | total |

### Efficiency
| Metric Name | Query | Window |
|-------------|-------|--------|
| `efficiency.avg.{agent}` | AVG(efficiency) from evaluations | 24h |
| `efficiency.wasted_calls.{agent}` | SUM(wastedCalls) | 24h |

## Anomaly Detection (built into the snapshot handler)

After computing each metric, compare to the rolling 7-day average of the same metric. Flag if:

| Condition | Severity | Action |
|-----------|----------|--------|
| Cost > 2× 7-day avg | 🔴 | `ctx.notify()` — immediate Telegram alert |
| Error rate > 5% (any agent) | 🔴 | `ctx.notify()` — immediate Telegram alert |
| Quality drop > 0.1 from 7-day avg | 🟡 | Include in next digest |
| Request backlog > 20 | 🟡 | Include in next digest |
| 0 sessions for an agent in 2h+ | 🟡 | Include in next digest |

The handler stores these as rows in an `alerts` table:
```sql
CREATE TABLE IF NOT EXISTS metric_alerts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_name  TEXT NOT NULL,
  severity     TEXT NOT NULL,   -- 'red', 'yellow'
  message      TEXT NOT NULL,
  value        REAL,
  threshold    REAL,
  created_at   INTEGER NOT NULL,
  resolved_at  INTEGER          -- NULL = still active
);
```

## Implementation

### Phase 1: Handler + Table (tech-lead builds)

**One file:** `agents/may/handlers/metrics-snapshot.ts` (~200 LOC)

```typescript
// Pseudocode structure:
export const create: HandlerModule["create"] = (ctx, entry) => {
  return async () => {
    const db = ctx.getDb();
    
    // Ensure tables exist
    db.exec(`CREATE TABLE IF NOT EXISTS metric_snapshots (...)`);
    db.exec(`CREATE TABLE IF NOT EXISTS metric_alerts (...)`);
    
    const now = Date.now();
    const metrics = computeAllMetrics(db, now);
    
    // Store each metric
    for (const m of metrics) {
      db.prepare(`INSERT INTO metric_snapshots ...`).run(m.name, m.value, ...);
    }
    
    // Check for anomalies
    const alerts = detectAnomalies(db, metrics, now);
    for (const a of alerts) {
      db.prepare(`INSERT INTO metric_alerts ...`).run(...);
      if (a.severity === 'red') ctx.notify(a.message);
    }
  };
};
```

**One cron entry** in `agents/may/cron.json`:
```json
{
  "name": "metrics-snapshot",
  "type": "job",
  "handler": "metrics-snapshot",
  "intervalMs": 3600000,
  "enabled": true,
  "description": "Compute metrics from raw data, store snapshots, detect anomalies (1h)"
}
```

### Phase 2: Surface in system_status (tech-lead adds)

Add a "Metrics" section to the existing `system_status` tool output. When any agent calls `system_status()`, they see:

```
## Metrics (last snapshot: 14 min ago)
Cost (24h): $42.50 (bob $12, coach $8, optimizer $7, ...)
Quality: 0.85 avg (↑0.02 from 7d avg)  
Health: 0.8% error rate, 0 stuck, 2 backlog
Flow: 312 requests completed, avg 156s
Alerts: ⚠️ Bob cost 2.1× 7d avg
```

### Phase 3: Digest integration

May's proof-of-life digest (from the output-channels design) pulls from `metric_snapshots` instead of running ad-hoc queries. The digest handler just reads the latest snapshot row for each metric.

### Phase 4: Extensibility

To add a new metric:
1. Add a function to `metrics-snapshot.ts` that returns `{ name, value, dimensions, window }`
2. Add it to the `computeAllMetrics()` array
3. Done. It auto-stores, auto-trends, auto-alerts.

No new protocol docs. No agent behavior changes. No ownership model. Just data.

## What This Replaces

| Old | New |
|-----|-----|
| `shared/protocols/metrics-framework.md` (383 lines, never used) | This design + ~200 LOC handler |
| "Bob writes research reports weekly" | SQL query runs hourly, stores result |
| "Tech-lead writes ops reports weekly" | SQL query runs hourly, stores result |
| "Coach writes scorecards per sprint" | SQL query runs hourly, stores result |
| "May collects from 4 agents and summarizes" | May reads `metric_snapshots` table |
| No anomaly detection | Automatic threshold comparison + Telegram alerts |

## Tracking

This is a **project we keep improving**. After Phase 1 ships:
- Review: Are the right metrics being tracked? Are thresholds useful?
- Extend: Add gym performance trends, convention compliance rates, etc.
- Refine: Tune anomaly thresholds based on false-positive/negative rate
- Evolve: New metrics for new concerns (e.g., agent specialization, task routing efficiency)

The design is deliberately minimal to start. The table schema is flexible — `metric_name` is just a string, `dimensions` is JSON. Adding new metrics is a 5-line function, not a protocol redesign.
