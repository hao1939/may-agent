# DESIGN: Unified Metric System

**Status:** DRAFT — awaiting Hao review  
**Date:** 2026-04-15  
**Author:** May (incorporating Hao's design direction)  
**Replaces:** `shared/protocols/metrics-framework.md` (deleted), earlier metrics-system.md draft

---

## Problem

The system has 8+ disconnected tracking mechanisms:

| System | What it tracks | Where it lives |
|--------|---------------|----------------|
| Request DB | Ad-hoc tasks (27K+) | `may.db` → `requests` table |
| Dispatch board | May's active priorities | `may/workspace/dispatch-board.md` |
| Improvement queue | Idle-time work | Various `todo.md` files |
| Cron job health | Process monitoring | `watchdog` handler |
| Experiments | 141 experiments | `may.db` → `experiments` table |
| Skills | 268 skill files | `shared/skills/` directory |
| Convention compliance | Per-agent, per-convention | `may.db` → `convention_checks` (77K rows) |
| Gym pass rates | 1,424 runs across 295 scenarios | `may.db` → `gym_runs` table |

Nobody has a unified view. May tracks some in dispatch board, optimizer tracks some in findings, coach tracks some in skill dashboard. Goals don't drive work because they're scattered across files.

## Core Idea

**Everything is a metric with an owner.**

A metric has:
- **Name**: what we're tracking
- **Owner**: who's responsible for pushing it forward  
- **Current value**: where we are now (auto-measured or manually recorded)
- **Target value**: where we want to be
- **Type**: `one-off` | `continuous` | `health`
- **Status**: `active` | `blocked` | `done` | `paused`
- **History**: measurements over time (time-series in DB)

## How Metric Types Work

### One-off Metrics (task completion)

**Pattern:** Receive → Execute → Done

Binary — either it's done or it isn't. "Fix verify-wrap bug", "Ship output channel Phase 1", "Enable prompt caching".

Agent behavior:
1. Read the metric goal
2. Do the work — `agents.fork()`, `workflow.run()`, or persistent-task for multi-step
3. Mark done when complete

**Current value:** 0 (not done) or 1 (done)  
**Target value:** 1  
**No strategy needed.** The task is clear, the end state is clear.

### Continuous Metrics (improve a number)

**Pattern:** Diagnose → Hypothesize → Act → Measure → Iterate

This is the hard one. "Improve coder quality from 0.6 to 0.9" doesn't have a single action.

Agent's heartbeat loop for a continuous metric:
1. **Read the metric** — where are we? What's the trend?
2. **Diagnose** — why is it at this level? What's holding it back?
3. **Pick an action** — what single thing would most likely move the number?
4. **Execute** — fork a persistent-task iteration
5. **Measure** — did the metric move? (auto-measured next snapshot, or manual check)
6. **Iterate** — if it moved, keep going. If not, try a different approach.

**Execution mechanism:** Persistent-task project file tracks: what we tried, what happened to the metric, what to try next.

**Example — Coach owns "coder quality score":**
- Heartbeat: reads metric → 0.6, target → 0.9
- Diagnoses: coder fails on "verify-after-edit" — 40% of failures  
- Action: create a skill file, test in gym
- Persistent-task: fork growth-cycle with that skill
- Next heartbeat: re-read metric. 0.7 → continue. Still 0.6 → try different intervention.

### Health Metrics (maintain a threshold)

**Pattern:** Monitor → Alert → Fix → Resume

Agent only acts when the metric drops below threshold.

Agent's heartbeat:
1. **Read the metric** — is it above threshold?
2. **If yes** — no action, move on
3. **If no** — diagnose why it dropped, fork a fix

**Example — May owns "heartbeat success rate > 99%":**
- Heartbeat: reads metric → 88%, threshold → 99%
- Below threshold → diagnose: which agent is failing?
- Fork a fix session or escalate to agent's owner

## Data Model

### Two tables: `metrics` (definitions) + `metric_snapshots` (time-series)

```sql
-- The metric registry — what we're tracking, who owns it, what's the goal
CREATE TABLE IF NOT EXISTS metrics (
  id          TEXT PRIMARY KEY,             -- e.g. "coder-quality", "fix-verify-wrap", "heartbeat-success"
  name        TEXT NOT NULL,                -- human-readable: "Coder Quality Score"
  type        TEXT NOT NULL,                -- 'one-off' | 'continuous' | 'health'
  owner       TEXT NOT NULL,                -- agent name: 'coach', 'tech-lead', 'may'
  current     REAL,                         -- latest measured value
  target      REAL NOT NULL,                -- goal value (1.0 for one-off = done)
  threshold   REAL,                         -- for health metrics: alert if below this
  unit        TEXT,                         -- '%', '$', 'count', 'score', null for one-off
  status      TEXT NOT NULL DEFAULT 'active', -- 'active' | 'blocked' | 'done' | 'paused'
  blocker     TEXT,                         -- why it's blocked (free text)
  project     TEXT,                         -- path to persistent-task project file, if any
  source      TEXT,                         -- 'auto' | 'manual' — how current value is measured
  source_query TEXT,                        -- SQL query for auto-measured metrics
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  closed_at   INTEGER                       -- when status changed to 'done'
);

-- Time-series measurements — every value ever recorded
CREATE TABLE IF NOT EXISTS metric_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id   TEXT NOT NULL REFERENCES metrics(id),
  value       REAL NOT NULL,
  measured_at INTEGER NOT NULL,
  measured_by TEXT,                          -- 'auto:metrics-snapshot' or 'manual:coach' etc.
  note        TEXT                           -- optional context: "after deploying skill X"
);

-- Alerts when metrics cross thresholds
CREATE TABLE IF NOT EXISTS metric_alerts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id   TEXT NOT NULL REFERENCES metrics(id),
  severity    TEXT NOT NULL,                -- 'red' | 'yellow'
  message     TEXT NOT NULL,
  value       REAL,
  threshold   REAL,
  created_at  INTEGER NOT NULL,
  resolved_at INTEGER                       -- NULL = still active
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_snapshots_metric ON metric_snapshots(metric_id, measured_at);
CREATE INDEX IF NOT EXISTS idx_metrics_owner ON metrics(owner, status);
CREATE INDEX IF NOT EXISTS idx_metrics_status ON metrics(status);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON metric_alerts(resolved_at) WHERE resolved_at IS NULL;
```

### Why two tables?

`metrics` is the **registry** — small, one row per goal. Agents query it to discover their owned metrics.  
`metric_snapshots` is the **time-series** — grows over time, one row per measurement. Enables trend analysis.

This is the same pattern as `evaluations` (one per session) vs. `sessions` (the registry). Small lookup table + large history table.

## How Existing Systems Map to Metrics

| Current System | Becomes | Example |
|---------------|---------|---------|
| Request DB task ("fix X") | One-off metric | `id: fix-verify-wrap, type: one-off, owner: tech-lead, target: 1` |
| Dispatch board priority | Active metric with status | Board becomes a **view** of `SELECT * FROM metrics WHERE status = 'active' ORDER BY priority` |
| Improvement queue item | One-off or continuous metric | `id: cost-limit-guard, type: one-off, owner: tech-lead, target: 1` |
| Cron job health | Health metric (auto-measured) | `id: watchdog-uptime, type: health, owner: may, threshold: 99, source: auto` |
| Experiment completion | One-off metric | `id: exp-147, type: one-off, owner: coach, target: 1` |
| Convention compliance | Health metric (auto-measured) | `id: convention-c1.1, type: health, owner: may, threshold: 95, source: auto` |
| Gym pass rate | Continuous metric (auto-measured) | `id: gym-pass-rate, type: continuous, owner: coach, current: 56.3, target: 70` |
| Agent quality score | Continuous metric (auto-measured) | `id: quality-coder, type: continuous, owner: coach, current: 0.75, target: 0.9` |

### What we DON'T migrate

The request DB (27K+ rows) stays as-is. We don't backfill old tasks as metrics. The metric system tracks **goals going forward**. Old requests are historical data.

The dispatch board becomes a **view** generated from the metrics table, not a manually edited file. May's heartbeat reads metrics instead of editing markdown.

## Measurement Pipeline

### Auto-measured metrics

For metrics with `source = 'auto'`, the `metrics-snapshot` cron handler runs the `source_query` SQL and records the result.

Examples of auto-measured metrics:

```
id: quality-coder
source_query: SELECT round(avg(quality), 2) FROM evaluations 
              WHERE agent = 'coder' AND createdAt > (strftime('%s','now')*1000 - 86400000)

id: gym-pass-rate  
source_query: SELECT round(100.0 * sum(passed) / count(*), 1) FROM gym_runs
              WHERE timestamp > datetime('now', '-7 days')

id: convention-c1.1
source_query: SELECT round(100.0 * sum(passed) / count(*), 1) FROM convention_checks
              WHERE convention = 'C1.1' AND checked_at > (strftime('%s','now')*1000 - 604800000)

id: daily-cost
source_query: SELECT round(sum(json_extract(usage, '$.cost')), 2) FROM evaluations
              WHERE createdAt > (strftime('%s','now')*1000 - 86400000)
```

### Manual metrics

For metrics with `source = 'manual'`, the owner records measurements when they have new data. They do this by writing to the DB in their session (or we add a lightweight `metric.record(id, value, note)` helper).

Examples:
- "Persistent task adoption" — tech-lead counts how many projects use the pattern
- "Research conclusion sprint" — bob records how many hypotheses he's concluded

### Hybrid

Some metrics are auto-measured but may benefit from manual annotations:
- Auto: "coder quality is 0.75"
- Manual note: "after deploying verify-after-edit skill, watching for 24h"

## The Snapshot Handler

**File:** `agents/may/handlers/metrics-snapshot.ts`  
**Cron:** Every 1 hour  
**~150 LOC**

```typescript
// Pseudocode
export const create: HandlerModule["create"] = (ctx, entry) => {
  return async () => {
    const db = ctx.getDb();
    ensureTables(db);
    
    const now = Date.now();
    
    // 1. Auto-measure all metrics with source_query
    const autoMetrics = db.prepare(
      "SELECT id, source_query, threshold, type FROM metrics WHERE source = 'auto' AND status = 'active'"
    ).all();
    
    for (const m of autoMetrics) {
      const row = db.prepare(m.source_query).get();
      const value = Object.values(row)[0] as number;
      
      // Record snapshot
      db.prepare("INSERT INTO metric_snapshots (metric_id, value, measured_at, measured_by) VALUES (?,?,?,?)")
        .run(m.id, value, now, 'auto:metrics-snapshot');
      
      // Update current value
      db.prepare("UPDATE metrics SET current = ?, updated_at = ? WHERE id = ?")
        .run(value, now, m.id);
      
      // Check for one-off completion
      if (m.type === 'one-off' && value >= 1) {
        db.prepare("UPDATE metrics SET status = 'done', closed_at = ? WHERE id = ?")
          .run(now, m.id);
      }
      
      // Check health threshold
      if (m.type === 'health' && m.threshold && value < m.threshold) {
        recordAlert(db, m.id, 'yellow', `${m.id} below threshold: ${value} < ${m.threshold}`, value, m.threshold, now);
      }
      
      // Check for regression (compare to 7-day average)
      checkRegression(db, m, value, now);
    }
    
    // 2. Check for stalled metrics (no snapshot movement in 48h)
    const stalled = db.prepare(`
      SELECT m.id, m.name, m.owner FROM metrics m
      WHERE m.status = 'active' AND m.type = 'continuous'
      AND m.updated_at < ?
    `).all(now - 48 * 60 * 60 * 1000);
    
    for (const s of stalled) {
      recordAlert(db, s.id, 'yellow', `${s.name} stalled — no progress in 48h (owner: ${s.owner})`, null, null, now);
    }
    
    // 3. Resolve alerts where metric recovered
    resolveRecoveredAlerts(db, now);
  };
};
```

## How Agents Interact with Metrics

### Discovery: "What do I own?"

Each agent's heartbeat starts by querying their metrics:

```sql
SELECT id, name, type, current, target, threshold, status, blocker, project
FROM metrics 
WHERE owner = ? AND status IN ('active', 'blocked')
ORDER BY type, current/target ASC  -- worst-performing first
```

This replaces reading `todo.md` or checking the dispatch board. The query IS the todo list.

### Execution: How agents drive metrics forward

**One-off:** Fork a session or persistent-task → mark done when complete.  
**Continuous:** Fork a persistent-task iteration → measurement updates automatically next snapshot.  
**Health:** Only act if below threshold → fork a fix.

When an agent picks up a continuous metric, they create a persistent-task project:
```
project: agents/<owner>/workspace/projects/metric-<id>.md
agent: <owner>
goal: Push <metric-name> from <current> to <target>
```

The persistent-task loop handles the iteration cycle. The metric system handles tracking and visibility.

### Recording: Manual measurement

For manual metrics, agents call:
```typescript
// Helper function (can be a simple INSERT, no new tool needed)
db.prepare("INSERT INTO metric_snapshots (metric_id, value, measured_at, measured_by, note) VALUES (?,?,?,?,?)")
  .run('persistent-task-adoption', 3, Date.now(), 'manual:tech-lead', 'Added 2 new projects this week');
db.prepare("UPDATE metrics SET current = ?, updated_at = ? WHERE id = ?")
  .run(3, Date.now(), 'persistent-task-adoption');
```

Or we provide a lightweight helper in the handler context, but raw SQL works fine.

## May's Role: Metric Overseer

May's heartbeat becomes:

```
1. Query: SELECT * FROM metrics WHERE status = 'active' ORDER BY type, updated_at ASC
2. Stalled? → metrics with no snapshot movement in 48h → nudge owner
3. Blocked? → metrics with status = 'blocked' → fix blocker or escalate to Hao
4. Regressing? → metrics where current < previous snapshot → alert owner
5. Unowned? → metrics with no owner or owner agent is down → reassign
```

May's dispatch board becomes a **generated view** from the metrics table. No more manually editing a markdown file.

### Generated Dashboard (replaces dispatch-board.md)

The proof-of-life digest and system-status tool read from metrics:

```
## Metric Dashboard (15 active, 3 blocked, 42 done)

### 🔴 Blocked
| Metric | Owner | Current | Target | Blocker |
|--------|-------|---------|--------|---------|
| Amy-kimi operational | may | down | running | Billing — waiting on Hao |
| Prompt caching | tech-lead | off | on | Need ANTHROPIC_API_KEY — waiting on Hao |

### 📈 Active — Continuous (sorted by gap to target)
| Metric | Owner | Current | Target | Trend | Last Update |
|--------|-------|---------|--------|-------|-------------|
| Coder quality | coach | 0.75 | 0.90 | ↑0.02/wk | 2h ago |
| Gym pass rate | coach | 56% | 70% | ↑1%/wk | 1h ago |
| Hypotheses tested | bob | 15% | 80% | ↑5%/wk | 3h ago |

### 🏥 Health (below threshold)
| Metric | Owner | Current | Threshold | Since |
|--------|-------|---------|-----------|-------|
| Heartbeat success rate | may | 88% | 99% | 6h ago |

### ✅ Recently Done (last 7d)
| Metric | Owner | Closed |
|--------|-------|--------|
| Fix verify-wrap bug | tech-lead | Apr 14 |
| Output channel Phase 1 | tech-lead | Apr 15 |
```

## Metric Lifecycle

### Creation

Anyone can propose a metric. Two paths:

1. **Hao creates directly** — "I want to track X, owner is Y" → INSERT into metrics table
2. **Agent proposes, May approves** — Agent notices something worth tracking → suggests via `agents.message('may', 'Propose metric: ...')` → May reviews (gatekeeper pattern) → INSERT if approved

### Closure

1. **One-off:** Auto-closes when `current >= target` (detected by snapshot handler)
2. **Continuous:** Owner proposes closure when target reached → May confirms
3. **Health:** Never closes — it's perpetual monitoring. Can be paused if irrelevant.

### Priority

We don't add a priority column. Instead, **the gap between current and target IS the priority**. Metrics furthest from their target get attention first. For one-off metrics, blocked = high priority, active = normal.

May can override by setting `status = 'paused'` on lower-priority metrics.

## What Changes for Agents

### Before (current)
```
Agent heartbeat:
1. Read todo.md — vague list of things to do
2. Check pending tasks — manual scan of dispatch board
3. Decide what to do — based on vibes and what seems important
4. Do something — maybe aligned with goals, maybe not
```

### After (with metrics)
```
Agent heartbeat:
1. Query my metrics — concrete list with numbers
2. Pick the worst one — furthest from target or recently regressed
3. Do one action — fork a persistent-task iteration, run a quick fix, or escalate
4. Exit — heartbeat stays short, substantive work in forks
```

This is a genuine behavioral improvement: **metrics make the decision for you**. The worst metric is the one you work on.

## Implementation Plan

### Phase 1: Schema + Snapshot Handler (~200 LOC)

1. **Create tables** in `may.db` (the `metrics`, `metric_snapshots`, `metric_alerts` tables above)
2. **Build `metrics-snapshot.ts` handler** — auto-measures metrics with `source_query`, records snapshots, checks thresholds
3. **Add cron entry** — 1h interval
4. **Seed initial metrics** — the ~15 auto-measurable metrics from existing DB data (quality scores, costs, gym rate, convention compliance)

### Phase 2: Surface in System Status + Digest (~50 LOC)

1. **Add metrics section to `system_status` tool** — agents see their metrics when they call system_status
2. **Update proof-of-life handler** — digest pulls from metric_snapshots instead of ad-hoc queries
3. **Add "my metrics" to heartbeat-context handler** — each agent's injected context includes their owned metrics

### Phase 3: Agent Behavior Changes (heartbeat edits)

1. **Update May's heartbeat** — replace dispatch board scanning with metric queries
2. **Update other agent heartbeats** — add "check my metrics" step
3. **Retire dispatch-board.md** — replace with generated view from metrics table

### Phase 4: Manual Metrics + Metric Creation (future)

1. **Add helper for manual measurement recording** — lightweight function in handler-context
2. **Build metric proposal flow** — agent proposes via message, May reviews
3. **Migration** — gradually convert existing todo.md items to metrics

## Initial Metric Set (Phase 1 seed data)

### Auto-measured (from existing DB)

| ID | Name | Type | Owner | Source Query | Target |
|----|------|------|-------|-------------|--------|
| `quality.coder` | Coder quality score | continuous | coach | AVG(quality) from evaluations WHERE agent='coder' (24h) | 0.90 |
| `quality.system` | System avg quality | health | may | AVG(quality) all agents (24h) | > 0.85 |
| `cost.daily` | Daily total cost | health | may | SUM(cost) from evaluations (24h) | < $50 |
| `gym.pass-rate` | Gym scenario pass rate | continuous | coach | passed/total from gym_runs (7d) | 70% |
| `convention.c1.1` | Convention C1.1 compliance | health | may | pass rate from convention_checks (7d) | > 95% |
| `health.error-rate` | System error rate | health | may | error sessions / total (24h) | < 2% |
| `research.experiments` | Experiments completed | continuous | bob | COUNT WHERE status='completed' | 150 |
| `research.hypotheses-tested` | Hypotheses conclusion rate | continuous | bob | concluded/total from hypotheses | 80% |

### Manual (seeded by Hao/May)

| ID | Name | Type | Owner | Current | Target |
|----|------|------|-------|---------|--------|
| `ops.amy-kimi` | Amy-kimi operational | health | may | 0 (down) | 1 (running) |
| `ops.prompt-caching` | Enable prompt caching | one-off | tech-lead | 0 | 1 |
| `infra.persistent-task-adoption` | Projects using persistent-task | continuous | tech-lead | 1 | 10 |

## Relationship to Persistent Tasks

A persistent-task project IS a metric being executed:

| Persistent Task Concept | Metric System Concept |
|--------------------------|----------------------|
| Project file goal | Metric target |
| Each iteration | One action toward the target |
| Owner review | Measuring whether the metric moved |
| Project status | Metric status |

They're complementary: persistent-task is the **execution mechanism**, metric is the **tracking mechanism**. The metric tells you WHAT to push, persistent-task tells you HOW.

## What This Replaces

| Old | New |
|-----|-----|
| `shared/protocols/metrics-framework.md` (deleted) | This design |
| Manually-edited dispatch-board.md | Generated view from metrics table |
| Vague todo.md per agent | `SELECT * FROM metrics WHERE owner = ?` |
| Ad-hoc "how's X doing?" questions | `SELECT * FROM metric_snapshots WHERE metric_id = ?` |
| No trend visibility | Time-series in metric_snapshots |
| No anomaly detection | Threshold checks + alerts |
| "Bob writes weekly reports" | Auto-measured, no human effort |

## Anti-Patterns to Avoid

1. **Metric explosion** — Don't create a metric for every small task. One-off metrics should be for significant goals, not "fix typo in README."
2. **Gaming** — Auto-measured metrics are harder to game. Manual metrics need May's oversight.
3. **Stale targets** — Targets should be reviewed periodically. A target set 3 months ago may no longer be relevant.
4. **Over-engineering** — Phase 1 is just 3 DB tables + 1 handler. Don't build a metrics UI, dashboard framework, or visualization layer until the data proves useful.

## Open Questions for Review

1. **Granularity of convention metrics** — One metric per convention (20+ metrics) or one aggregate "convention compliance" metric? Suggest: one aggregate + individual only for conventions below threshold.
2. **Cost targets** — What's the right daily cost target? Current run rate is ~$20-40/day. Need Hao input.
3. **Who creates the initial metric set?** — May seeds auto-measured ones from existing data. Hao approves the target values.
4. **Metric tool vs raw SQL?** — Should we add a `metrics` tool to the agent tool set, or is raw SQL sufficient? Raw SQL for Phase 1, consider a tool if agents struggle.
