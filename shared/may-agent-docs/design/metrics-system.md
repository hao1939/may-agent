# DESIGN: Unified Metric System

**Status:** ✅ APPROVED by Hao — Phase 1 implementation in progress  
**Date:** 2026-04-15 (approved 2026-04-15 ~14:50 UTC)  
**Author:** May (synthesizing input from Bob, Tech-lead, Optimizer, Coach, Scout + Hao's feedback)  
**Replaces:** `shared/protocols/metrics-framework.md` (deleted), earlier metrics-system.md drafts

---

## Hao's Approval Decisions (2026-04-15)

**APPROVED.** Proceed with Phase 1. Key decisions:

1. **Cost metrics: REMOVE from Phase 1.** `cost.daily` and `efficiency.daily-ops` are deferred. Hao wants the system to be creative first — cost optimization comes later.
2. **Convention metrics: Owner decides granularity.** If one aggregate helps May spot issues and she dispatches coach to investigate specifics, that's fine. If coach needs per-convention breakdown, add those. Let owners decide.
3. **New metric approval process: May approves P2, Hao approves P0/P1.** Agents can propose metrics. P2 (nice-to-have) metrics get approved by May. P0/P1 require Hao's sign-off.
4. **Gym scenario quality: Track it with simple proxies.** Pass rate, discrimination rate. Acknowledge it's complex — don't over-engineer the measurement. It's a signal, not a precise instrument.
5. **Ownership: May owns the metric system.** She drives adoption (seeds initial metrics, ensures agents query them, retires old tracking). Tech-lead implements the code (schema, snapshot handler, system_status integration).

### Changes to Initial Metric Set
- **REMOVED:** `cost.daily` (was health metric owned by May)
- **REMOVED:** `efficiency.daily-ops` (was health metric owned by Optimizer)
- **KEPT:** Everything else as proposed
- **ADDED:** `gym.scenario-discrimination` — simple proxy for gym scenario quality (% of scenarios that distinguish good vs bad agent behavior)

---

## Core Principle: Metrics Are Signals, Not Targets

> *"When a measure becomes a target, it ceases to be a good measure."* — Goodhart's Law (raised by Bob)

**This is the foundational constraint of the entire system.** Metrics exist to indicate issues, gaps, and trends. They inform human and agent judgment — they don't replace it.

Concretely:
- **A metric regression is a signal to investigate**, not an automatic trigger to "fix the number"
- **False alarms are acceptable** — a signal system that occasionally fires on noise is better than one that misses real problems
- **Agents use metrics to SPOT problems, not chase numbers blindly** — if Bob's worst metric says "conclude more hypotheses" but he just found an interesting cross-cutting pattern, he should follow the pattern
- **Quality is qualitative** — counts and percentages are proxies. A hypothesis concluded as "not testable" is different from one confirmed with 3 experiments. Metrics can't capture this, and we don't pretend they can
- **No metric should be the sole input to any decision** — agents combine metric data with their own judgment, context, and expertise

This principle must be reinforced in agent heartbeats when the metric system is deployed. Without it, we'll optimize numbers while degrading actual output quality.

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
- **Current value**: where we are now (auto-measured, shell-measured, or manually recorded)
- **Target value**: where we want to be
- **Type**: `one-off` | `continuous` | `health`
- **Priority**: P0 (urgent) | P1 (important) | P2 (nice-to-have)
- **Status**: `active` | `blocked` | `done` | `paused` | `archived`
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

**Key: prefer velocity over stock** (from Bob). Metrics like "experiments completed = 143, target = 150" hit their target and become useless. Better: measure rates — "experiments completed per week ≥ 2" as a health metric, or "% of hypotheses with at least 1 supporting experiment" as a continuous metric. Static stock targets should be avoided for ongoing work.

**Execution mechanism:** Persistent-task project file tracks: what we tried, what happened to the metric, what to try next.

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

### Four tables: `metrics`, `metric_snapshots`, `metric_alerts`, `research_log`

```sql
-- The metric registry — what we're tracking, who owns it, what's the goal
CREATE TABLE IF NOT EXISTS metrics (
  id              TEXT PRIMARY KEY,             -- e.g. "quality.coder", "fix-verify-wrap", "health.heartbeat"
  name            TEXT NOT NULL,                -- human-readable: "Coder Quality Score"
  type            TEXT NOT NULL,                -- 'one-off' | 'continuous' | 'health'
  owner           TEXT NOT NULL,                -- agent name: 'coach', 'tech-lead', 'may'
  current         REAL,                         -- latest measured value
  target          REAL NOT NULL,                -- goal value (1.0 for one-off = done)
  threshold       REAL,                         -- for health metrics: alert if below this
  unit            TEXT,                         -- '%', '$', 'count', 'score', null for one-off
  priority        TEXT NOT NULL DEFAULT 'P1',   -- 'P0' | 'P1' | 'P2' — explicit priority
  status          TEXT NOT NULL DEFAULT 'active', -- 'active' | 'blocked' | 'done' | 'paused' | 'archived'
  blocker         TEXT,                         -- why it's blocked (free text)
  project         TEXT,                         -- path to persistent-task project file, if any
  source          TEXT,                         -- 'auto' | 'command' | 'manual' — how current value is measured
  source_query    TEXT,                         -- SQL query for auto-measured metrics (source='auto')
  source_command  TEXT,                         -- Shell command for command-measured metrics (source='command')
  sensitivity     REAL,                         -- min % change to trigger regression alert (default: 15%)
  measure_interval INTEGER,                    -- expected hours between measurements (for staleness detection)
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  closed_at       INTEGER                       -- when status changed to 'done' or 'archived'
);

-- Time-series measurements — every value ever recorded
CREATE TABLE IF NOT EXISTS metric_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id   TEXT NOT NULL REFERENCES metrics(id),
  value       REAL NOT NULL,
  sample_size INTEGER,                          -- n: how many data points this was computed from
  measured_at INTEGER NOT NULL,
  measured_by TEXT,                              -- 'auto:metrics-snapshot' or 'manual:coach' etc.
  note        TEXT                               -- optional context: "after deploying skill X"
);

-- Alerts when metrics cross thresholds
CREATE TABLE IF NOT EXISTS metric_alerts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id   TEXT NOT NULL REFERENCES metrics(id),
  severity    TEXT NOT NULL,                    -- 'red' | 'yellow'
  message     TEXT NOT NULL,
  value       REAL,
  threshold   REAL,
  created_at  INTEGER NOT NULL,
  resolved_at INTEGER                           -- NULL = still active
);

-- Research output log for filesystem-based agents (Bob, Scout)
-- Enables auto-measurement of file-based work without filesystem scraping
CREATE TABLE IF NOT EXISTS research_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL,                    -- 'deep-dive', 'hypothesis', 'experiment', 'triage', 'knowledge-entry'
  ref         TEXT,                             -- 'DD#690', 'H-097', 'KE-187', 'EXP-148'
  agent       TEXT NOT NULL,                    -- 'bob', 'scout'
  rating      INTEGER,                          -- 1-5 stars (optional quality self-rating)
  created_at  INTEGER NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_snapshots_metric ON metric_snapshots(metric_id, measured_at);
CREATE INDEX IF NOT EXISTS idx_metrics_owner ON metrics(owner, status);
CREATE INDEX IF NOT EXISTS idx_metrics_status ON metrics(status);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON metric_alerts(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_research_log_agent ON research_log(agent, type, created_at);
```

### Design Decisions Explained

**Explicit `priority` field (P0/P1/P2)** — All 5 agents agreed: gap-to-target doesn't work as priority. A one-off with current=0, target=1 always has gap=1 regardless of importance. Different units make gap comparison meaningless across metrics (56% gym pass rate gap vs 0.15 quality score gap). Keep it simple.

**`source_command` field** (from Tech-lead) — Many metrics aren't in the DB. TypeScript checks, git history, file counts, test pass rates all need shell commands. The snapshot handler runs `source_command` and parses stdout as a number. Examples:
- `tsc --noEmit 2>&1 | grep -c 'error' || echo 0`
- `git log --since='7 days ago' --oneline -- library/deep-dives/ | wc -l`
- `find agents/shared/knowledge/entries/ -name '*.md' | wc -l`

**`sensitivity` field** (from Optimizer) — Efficiency metrics naturally fluctuate ±10% day-to-day. A regression alert for any single-snapshot dip is noise. `sensitivity` sets the minimum % change from the 7-day average before an alert fires. Default: 15%. Agents with stable metrics can set it lower.

**`measure_interval` field** (from Coach, Scout) — The 48h stale detection only works for auto-measured metrics. Manual metrics (like `skill.effectiveness`) may go a week without updates. `measure_interval` sets the expected update cadence per metric. If `now - last_snapshot > measure_interval`, it's stale. This replaces the one-size-fits-all 48h rule.

**`sample_size` on snapshots** (from Coach) — A quality score from 3 sessions is noise; one from 50 is signal. Recording `n` alongside `value` lets agents and May weight their confidence in a metric appropriately. The snapshot handler records this automatically for SQL-based metrics by running a COUNT alongside the AVG.

**`research_log` table** (from Scout) — Bob and Scout produce files (hypotheses, deep dives, knowledge entries), not DB rows. Rather than scraping the filesystem, agents INSERT a row when they produce output. This makes research throughput trivially auto-queryable. Both agents add one INSERT in their exit step — minimal friction.

**`archived` status** (from Tech-lead) — Continuous metrics can become irrelevant over time. `paused` means "temporarily inactive, might resume." `archived` means "no longer relevant, keep history but stop tracking." This prevents the active metric set from accumulating noise.

### Why four tables?

`metrics` is the **registry** — small, one row per goal. Agents query it to discover their owned metrics.  
`metric_snapshots` is the **time-series** — grows over time, one row per measurement. Enables trend analysis.  
`metric_alerts` is the **alert log** — fires on threshold breaches and regressions. Includes dedup logic.  
`research_log` is the **bridge** between filesystem-based work and SQL-queryable metrics.

## How Existing Systems Map to Metrics

| Current System | Becomes | Example |
|---------------|---------|---------|
| Request DB task ("fix X") | One-off metric | `id: fix-verify-wrap, type: one-off, owner: tech-lead, target: 1` |
| Dispatch board priority | Active metric with status | Board becomes a **view** of `SELECT * FROM metrics WHERE status = 'active' ORDER BY priority` |
| Improvement queue item | One-off or continuous metric | `id: cost-limit-guard, type: one-off, owner: tech-lead, target: 1` |
| Cron job health | Health metric (auto-measured) | `id: health.watchdog-uptime, type: health, owner: may, threshold: 99, source: auto` |
| Convention compliance | Health metric (auto-measured) | `id: convention.aggregate, type: health, owner: may, threshold: 90, source: auto` |
| Gym pass rate | Continuous metric (auto-measured) | `id: gym.pass-rate, type: continuous, owner: coach, current: 56.3, target: 70` |
| Agent quality score | Continuous metric (auto-measured) | `id: quality.coder, type: continuous, owner: coach, current: 0.75, target: 0.9` |
| Scout's DD/CR counters in todo.md | Auto from research_log | `id: research.dd-rate, type: health, owner: scout, source: auto` |
| Bob's experiment tracker | Auto from experiments table | `id: research.experiments-rate, type: health, owner: bob, source: auto` |

### What we DON'T migrate

The request DB (27K+ rows) stays as-is. We don't backfill old tasks as metrics. The metric system tracks **goals going forward**. Old requests are historical data.

The dispatch board becomes a **view** generated from the metrics table, not a manually edited file. May's heartbeat reads metrics instead of editing markdown.

### What gets retired (from Scout)

When the metric system is live, these per-agent tracking systems are replaced:
- Scout's DD/CR/Session counters in `todo.md` → replaced by `research_log` + metric queries
- Bob's experiment-tracking summaries → replaced by existing `experiments` table + metric queries
- Optimizer's findings docs (efficiency measurements) → replaced by auto-measured efficiency metrics
- Per-agent `todo.md` priority lists → replaced by `SELECT * FROM metrics WHERE owner = ?`

## Measurement Pipeline

### Auto-measured metrics (`source = 'auto'`)

For metrics with SQL source queries, the `metrics-snapshot` handler runs `source_query` and records the result.

```
id: quality.coder
source_query: SELECT round(avg(quality), 2) FROM evaluations 
              WHERE agent = 'coder' AND createdAt > (strftime('%s','now')*1000 - 86400000)

id: gym.pass-rate  
source_query: SELECT round(100.0 * sum(passed) / count(*), 1) FROM gym_runs
              WHERE timestamp > datetime('now', '-7 days')

id: convention.aggregate
source_query: SELECT round(100.0 * sum(passed) / count(*), 1) FROM convention_checks
              WHERE checked_at > (strftime('%s','now')*1000 - 604800000)

id: research.dd-rate
source_query: SELECT COUNT(*) FROM research_log 
              WHERE type = 'deep-dive' AND created_at > (strftime('%s','now')*1000 - 604800000)
```

### Command-measured metrics (`source = 'command'`)

For metrics needing shell execution (from Tech-lead), the handler runs `source_command` and parses stdout as a number.

```
id: health.tsc-clean
source_command: cd /app && tsc --noEmit 2>&1 | grep -c 'error' || echo 0

id: health.test-pass-rate
source_command: cd /app && vitest --run 2>&1 | tail -1 | grep -oP '\d+(?= passed)' || echo 0

id: health.review-branches
source_command: git branch -r --list 'review/*' 2>/dev/null | wc -l

id: research.knowledge-entries
source_command: find agents/shared/knowledge/entries/ -name '*.md' | wc -l
```

**Security note:** `source_command` values are set only by May or Hao, never by agent self-registration. Commands run in the snapshot handler context with no network access.

### Manual metrics (`source = 'manual'`)

For metrics requiring judgment, the owner records measurements when they have new data:

```typescript
db.prepare("INSERT INTO metric_snapshots (metric_id, value, sample_size, measured_at, measured_by, note) VALUES (?,?,?,?,?,?)")
  .run('skill.effectiveness', 0.4, 8, Date.now(), 'manual:coach', 'After promoting verify-after-edit skill');
db.prepare("UPDATE metrics SET current = ?, updated_at = ? WHERE id = ?")
  .run(0.4, Date.now(), 'skill.effectiveness');
```

Examples of manual metrics:
- `infra.persistent-task-adoption` — tech-lead counts during lens rotations
- `skill.effectiveness` — coach assesses after each growth cycle
- `research.novelty-ratio` — scout rates DDs at write time

### Intervention annotations (from Coach)

When an agent deploys an intervention (skill promotion, config change, new tool), they record it in the snapshot `note` field:

```
note: "INTERVENTION: promoted skill verify-after-edit to coder at 14:30"
```

This lets anyone reviewing metric trends see what actions were taken at what times, enabling attribution of changes. Not a structured field (that's over-engineering for Phase 1), but a convention: prefix intervention notes with `INTERVENTION:` for greppability.

## The Snapshot Handler

**File:** `agents/may/handlers/metrics-snapshot.ts`  
**Cron:** Every 1 hour  
**~200 LOC**

```typescript
// Pseudocode
export const create: HandlerModule["create"] = (ctx, entry) => {
  return async () => {
    const db = ctx.getDb();
    ensureTables(db);
    
    const now = Date.now();
    
    // 1. Auto-measure all SQL-based metrics
    const autoMetrics = db.prepare(
      "SELECT id, source_query, threshold, type, sensitivity FROM metrics WHERE source = 'auto' AND status = 'active'"
    ).all();
    
    for (const m of autoMetrics) {
      try {
        const row = db.prepare(m.source_query).get();
        const value = Object.values(row)[0] as number;
        
        // Also get sample size if the query supports it
        const sampleSize = getSampleSize(db, m);
        
        // Record snapshot
        db.prepare(
          "INSERT INTO metric_snapshots (metric_id, value, sample_size, measured_at, measured_by) VALUES (?,?,?,?,?)"
        ).run(m.id, value, sampleSize, now, 'auto:metrics-snapshot');
        
        // Update current value
        db.prepare("UPDATE metrics SET current = ?, updated_at = ? WHERE id = ?")
          .run(value, now, m.id);
        
        // Check one-off completion
        if (m.type === 'one-off' && value >= 1) {
          db.prepare("UPDATE metrics SET status = 'done', closed_at = ? WHERE id = ?")
            .run(now, m.id);
        }
        
        // Check health threshold
        if (m.type === 'health' && m.threshold && value < m.threshold) {
          recordAlertWithDedup(db, m.id, 'yellow', 
            `${m.id} below threshold: ${value} < ${m.threshold}`, value, m.threshold, now);
        }
        
        // Check regression with sensitivity
        checkRegressionWithSensitivity(db, m, value, now);
      } catch (e) {
        // Log but don't fail — one broken query shouldn't stop all measurements
        console.error(`Failed to measure ${m.id}: ${e.message}`);
      }
    }
    
    // 2. Command-measure shell-based metrics
    const cmdMetrics = db.prepare(
      "SELECT id, source_command, threshold, type, sensitivity FROM metrics WHERE source = 'command' AND status = 'active'"
    ).all();
    
    for (const m of cmdMetrics) {
      try {
        const result = execSync(m.source_command, { timeout: 10000 }).toString().trim();
        const value = parseFloat(result);
        if (!isNaN(value)) {
          db.prepare(
            "INSERT INTO metric_snapshots (metric_id, value, measured_at, measured_by) VALUES (?,?,?,?)"
          ).run(m.id, value, now, 'auto:metrics-snapshot');
          db.prepare("UPDATE metrics SET current = ?, updated_at = ? WHERE id = ?")
            .run(value, now, m.id);
          // Same threshold + regression checks as above
        }
      } catch (e) {
        console.error(`Failed to measure ${m.id} via command: ${e.message}`);
      }
    }
    
    // 3. Check for stalled metrics using measure_interval
    const stalled = db.prepare(`
      SELECT m.id, m.name, m.owner, m.measure_interval FROM metrics m
      WHERE m.status = 'active'
      AND (
        (m.measure_interval IS NOT NULL AND m.updated_at < ?)
        OR (m.measure_interval IS NULL AND m.source = 'manual' AND m.updated_at < ?)
      )
    `).all(
      now - /* per-metric interval */ 0, // actual implementation checks per-row
      now - 48 * 60 * 60 * 1000          // default 48h for manual without interval
    );
    
    for (const s of stalled) {
      recordAlertWithDedup(db, s.id, 'yellow', 
        `${s.name} stalled — no update in expected interval (owner: ${s.owner})`, null, null, now);
    }
    
    // 4. Resolve alerts where metric recovered
    resolveRecoveredAlerts(db, now);
  };
};

// Dedup: don't re-alert on the same metric until it recovers and regresses again
function recordAlertWithDedup(db, metricId, severity, message, value, threshold, now) {
  const existing = db.prepare(
    "SELECT id FROM metric_alerts WHERE metric_id = ? AND resolved_at IS NULL"
  ).get(metricId);
  if (existing) return; // Already alerting on this metric
  db.prepare(
    "INSERT INTO metric_alerts (metric_id, severity, message, value, threshold, created_at) VALUES (?,?,?,?,?,?)"
  ).run(metricId, severity, message, value, threshold, now);
}

// Only alert on regression if change exceeds sensitivity threshold
function checkRegressionWithSensitivity(db, metric, currentValue, now) {
  const sensitivity = metric.sensitivity || 0.15; // default 15%
  const avg7d = db.prepare(`
    SELECT avg(value) as avg_val FROM metric_snapshots 
    WHERE metric_id = ? AND measured_at > ?
  `).get(metric.id, now - 7 * 24 * 60 * 60 * 1000);
  
  if (avg7d?.avg_val && avg7d.avg_val > 0) {
    const changeRatio = (avg7d.avg_val - currentValue) / avg7d.avg_val;
    if (changeRatio > sensitivity) {
      recordAlertWithDedup(db, metric.id, 'yellow',
        `${metric.id} regressed ${(changeRatio * 100).toFixed(1)}% vs 7d avg`, 
        currentValue, avg7d.avg_val, now);
    }
  }
}
```

## How Agents Interact with Metrics

### Discovery: "What do I own?"

Each agent's heartbeat starts by querying their metrics:

```sql
SELECT id, name, type, current, target, threshold, status, blocker, project, priority
FROM metrics 
WHERE owner = ? AND status IN ('active', 'blocked')
ORDER BY priority, type, (target - COALESCE(current, 0)) / NULLIF(target, 0) DESC
```

This replaces reading `todo.md` or checking the dispatch board. The query IS the todo list — **but it's a signal, not a command.** Agents use the result to inform their work selection, not blindly chase the worst number.

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

### Recording: Manual measurement

For manual metrics, agents call a simple INSERT. For research agents, they INSERT into `research_log` after each output, enabling auto-measurement of throughput.

### Metric decomposition (from Coach)

Aggregate metrics like `quality.coder = 0.75` aren't actionable without knowing WHY. Each continuous metric should have pre-defined drill-down queries stored as comments or in a companion doc. Example:

```sql
-- Drill-down for quality.coder: failure mode breakdown
SELECT 
  json_extract(details, '$.top_failure_mode') as mode,
  count(*) as n,
  round(avg(quality), 2) as avg_quality
FROM evaluations 
WHERE agent = 'coder' AND createdAt > (strftime('%s','now')*1000 - 604800000)
GROUP BY mode ORDER BY n DESC
```

These aren't in the schema — they're documentation. The agent who owns a continuous metric should maintain drill-down queries in their persistent-task project file.

## May's Role: Metric Overseer

May's heartbeat becomes:

```
1. Query: SELECT * FROM metrics WHERE status = 'active' ORDER BY priority, type, updated_at ASC
2. Stalled? → metrics past their measure_interval → nudge owner
3. Blocked? → metrics with status = 'blocked' → fix blocker or escalate to Hao
4. Regressing? → check metric_alerts for unresolved alerts → notify owner
5. Unowned? → metrics with no owner or owner agent is down → reassign
6. Low confidence? → snapshots with sample_size < 5 → flag as noisy
```

May's dispatch board becomes a **generated view** from the metrics table.

### Generated Dashboard (replaces dispatch-board.md)

```
## Metric Dashboard (15 active, 3 blocked, 42 done)

### 🔴 Blocked
| Metric | Owner | P | Current | Target | Blocker |
|--------|-------|---|---------|--------|---------|
| Amy-kimi operational | may | P0 | down | running | Billing — waiting on Hao |
| Prompt caching | tech-lead | P1 | off | on | Need ANTHROPIC_API_KEY |

### 📈 Active — Continuous (by priority, then gap)
| Metric | Owner | P | Current | Target | Trend | n | Last |
|--------|-------|---|---------|--------|-------|---|------|
| Coder quality | coach | P1 | 0.75 | 0.90 | ↑0.02/wk | 47 | 2h ago |
| Gym pass rate | coach | P1 | 56% | 70% | ↑1%/wk | 295 | 1h ago |
| Hypotheses concluded | bob | P1 | 49% | 80% | ↑5%/wk | 70 | 3h ago |

### 🏥 Health (below threshold)
| Metric | Owner | P | Current | Threshold | Since |
|--------|-------|---|---------|-----------|-------|
| Heartbeat success | may | P0 | 88% | 99% | 6h ago |
| arXiv coverage gap | scout | P2 | 4d | <3d | 1d ago |

### ✅ Recently Done (last 7d)
| Metric | Owner | Closed |
|--------|-------|--------|
| Fix verify-wrap bug | tech-lead | Apr 14 |
```

## Metric Lifecycle

### Creation

Anyone can propose a metric. Two paths:

1. **Hao creates directly** — "I want to track X, owner is Y" → INSERT into metrics table
2. **Agent proposes, May approves** — Agent suggests via `agents.message('may', 'Propose metric: ...')` → May reviews → INSERT if approved

### Closure

1. **One-off:** Auto-closes when `current >= target`
2. **Continuous:** Owner proposes closure when target reached → May confirms → `status = 'done'`
3. **Health:** Never closes — perpetual monitoring. Can be `paused` or `archived` if irrelevant.

### Archival (from Tech-lead)

Metrics that are no longer relevant move to `archived` status:
- `paused` = temporarily inactive, might resume
- `archived` = no longer relevant, keep history but stop tracking and alerting
- Prevents the active metric set from accumulating noise over months

### Priority

**Explicit P0/P1/P2** (consensus from all 5 agents). Within a priority band, gap-to-target is the secondary sort. May can override by adjusting priority or status.

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
1. Query my metrics — concrete list with numbers and priorities
2. Consider the worst one — furthest from target within highest priority band
3. Apply judgment — is this the right thing to work on? Override if context says otherwise
4. Do one action — fork a persistent-task iteration, run a quick fix, or escalate
5. Exit — heartbeat stays short, substantive work in forks
```

**Critical difference from v1:** Step 3 is new. The metric doesn't make the decision FOR you — it informs the decision. This is the Goodhart's Law guardrail.

### Per-agent changes (KE-008 compliant — no structural heartbeat changes)

All agents add ONE query to their existing observation step:
```sql
SELECT id, name, type, current, target, priority FROM metrics 
WHERE owner = ? AND status = 'active' ORDER BY priority
```

This **adds data** to the decision step — it doesn't replace existing judgment. Agents that use lens rotation (tech-lead), growth cycles (coach), or exploration modes (optimizer) keep those patterns. The metric query is an input, not a replacement.

### Research agents (Bob, Scout) additionally

Add one INSERT to their exit step when they produce output:
```sql
INSERT INTO research_log (type, ref, agent, rating, created_at) 
VALUES ('hypothesis', 'H-098', 'bob', NULL, strftime('%s','now')*1000)
```

This feeds auto-measurement of throughput metrics without changing how they work.

## Cross-Agent Relationships

### Leading indicators (from Optimizer)

Some metrics predict others with a time lag:
- `efficiency.ops-per-session` ↑ → `cost.daily` ↑ (24h lag)
- `research.hypothesis-generation` ↑ → `research.hypotheses-concluded` ↑ (2-4 week lag)
- `gym.pass-rate` ↑ → `quality.coder` ↑ (1-2 week lag)

**Phase 1:** Not modeled in schema. Documented here so May can reason about cascading effects.  
**Phase 2:** Consider a `leads` TEXT field (comma-separated metric IDs) for structured relationships.

### Hypothesis pickup rate (from Scout)

`research.hypothesis-pickup-rate` — % of hypotheses that get tested by Bob/Coach within 14 days. This is a cross-agent metric measuring whether Scout's research output is actionable. Owned by Scout (produces hypotheses) but requires Bob to record pickups (already done in experiments table). Auto-measurable via:

```sql
SELECT round(100.0 * COUNT(DISTINCT e.hypothesis_id) / NULLIF(COUNT(DISTINCT h.id), 0), 1)
FROM hypotheses h
LEFT JOIN experiments e ON e.hypothesis_id = h.id AND e.created_at < h.created_at + 14*86400*1000
WHERE h.created_at > (strftime('%s','now')*1000 - 2592000000) -- last 30 days
```

(Exact query depends on schema — may need adjustment. Included as a model for cross-agent metrics.)

## Implementation Plan

### Phase 1: Schema + Snapshot Handler (~250 LOC)

1. **Create tables** in `may.db` — `metrics`, `metric_snapshots`, `metric_alerts`, `research_log`
2. **Build `metrics-snapshot.ts` handler** — auto-measures `source='auto'` and `source='command'` metrics, records snapshots, checks thresholds with dedup, checks regressions with sensitivity
3. **Add cron entry** — 1h interval
4. **Seed initial metrics** — the ~12 auto-measurable metrics from existing DB data
5. **Validate source_queries on INSERT** — run each query in a test transaction to catch broken SQL early (from Coach's nit)

### Phase 2: Surface in System Status + Digest (~50 LOC)

1. **Add metrics section to `system_status` tool** — agents see their metrics when they call system_status
2. **Update proof-of-life handler** — digest pulls from metric_snapshots
3. **Add "my metrics" to heartbeat-context handler** — each agent's injected context includes their owned metrics

### Phase 3: Agent Behavior Changes (heartbeat edits)

1. **Update agent heartbeats** — add metric query to observation step (per KE-008: within existing steps, not new steps)
2. **Add `research_log` INSERT to Bob and Scout exit steps**
3. **Retire dispatch-board.md** — replace with generated view from metrics table
4. **Retire per-agent todo.md priority tracking** — replaced by metric queries
5. **Add Goodhart's Law reminder** to each agent's heartbeat: "Metrics are signals. Override if your judgment says otherwise."

### Phase 4: Refinement (future)

1. **Manual measurement helper** — lightweight function in handler-context
2. **Metric proposal flow** — agent proposes via message, May reviews
3. **Leading indicator relationships** — structured `leads` field
4. **Drill-down query library** — companion doc for each continuous metric
5. **Op-level instrumentation** (from Optimizer) — `tool_calls` table for deeper efficiency analysis

## Initial Metric Set (Phase 1 seed data)

### Auto-measured from DB (`source = 'auto'`)

| ID | Name | Type | Owner | P | Target | Sensitivity |
|----|------|------|-------|---|--------|-------------|
| `quality.coder` | Coder quality score | continuous | coach | P1 | 0.90 | 15% |
| `quality.bob` | Bob quality score | continuous | coach | P1 | 0.90 | 15% |
| `quality.system` | System avg quality | health | may | P1 | > 0.85 | 10% |
| `cost.daily` | Daily total cost | health | may | P1 | < $50 | 20% |
| `gym.pass-rate` | Gym pass rate | continuous | coach | P1 | 70% | 10% |
| `convention.aggregate` | Convention compliance | health | may | P1 | > 90% | 10% |
| `health.error-rate` | System error rate | health | may | P0 | < 2% | — |
| `efficiency.ops-per-session` | Avg ops/session (24h) | continuous | optimizer | P2 | ≤ 25 | 15% |
| `efficiency.daily-ops` | Total daily ops | health | optimizer | P2 | < 5000 | 20% |
| `research.experiments-rate` | Experiments completed/week | health | bob | P2 | ≥ 2 | — |
| `research.hypotheses-concluded` | Hypothesis conclusion rate | continuous | bob | P1 | 80% | 15% |

### Auto-measured from research_log (`source = 'auto'`, requires agents to INSERT)

| ID | Name | Type | Owner | P | Target |
|----|------|------|-------|---|--------|
| `research.dd-rate` | Deep dives per week | health | scout | P2 | ≥ 15 |
| `research.hypothesis-generation` | Hypotheses proposed (30d) | continuous | scout | P2 | ongoing |

### Command-measured (`source = 'command'`)

| ID | Name | Type | Owner | P | Threshold | Command |
|----|------|------|-------|---|-----------|---------|
| `health.tsc-clean` | TypeScript errors | health | tech-lead | P1 | 0 | `tsc --noEmit 2>&1 \| grep -c error \|\| echo 0` |
| `health.test-pass-rate` | Test pass rate | health | tech-lead | P1 | 100% | *(vitest command TBD)* |

### Manual (`source = 'manual'`)

| ID | Name | Type | Owner | P | Target | measure_interval |
|----|------|------|-------|---|--------|-----------------|
| `ops.prompt-caching` | Enable prompt caching | one-off | tech-lead | P1 | 1 | — |
| `infra.persistent-task-adoption` | Projects using persistent-task | continuous | tech-lead | P2 | 10 | 168h (weekly) |
| `skill.effectiveness` | Skills that move quality | continuous | coach | P1 | 60% | 72h |
| `research.novelty-ratio` | % DDs rated ★★★★+ | continuous | scout | P2 | > 40% | 168h (weekly) |

## Relationship to Persistent Tasks

| Persistent Task Concept | Metric System Concept |
|--------------------------|----------------------|
| Project file goal | Metric target |
| Each iteration | One action toward the target |
| Owner review | Measuring whether the metric moved |
| Project status | Metric status |

Complementary: persistent-task is the **execution mechanism**, metric is the **tracking mechanism**. The metric tells you WHAT to push, persistent-task tells you HOW.

## Anti-Patterns to Avoid

1. **Metric explosion** — Start with ~15 metrics, not 50. Add only when there's a clear gap. If you can't explain why a metric exists in one sentence, don't create it (from Tech-lead: "main risk is over-measurement").
2. **Number chasing (Goodhart's)** — If an agent's output quality drops while their metric improves, the metric is being gamed. May should watch for this pattern and intervene.
3. **Stale targets** — Review targets quarterly. A target set 3 months ago may no longer be relevant.
4. **Over-engineering** — Phase 1 is 4 DB tables + 1 handler. No metrics UI, no dashboard framework, no visualization layer. The data proves useful first.
5. **Ignoring sample size** — A metric based on 3 data points is noise. Check `sample_size` before acting on changes. Coach especially flagged this risk.
6. **Alert fatigue** — Dedup prevents repeated alerts. Sensitivity prevents noise. But if agents start ignoring alerts, the system is broken — reduce the metric count rather than adding more alerts.

## Open Questions for Hao

1. **Cost targets** — What's the right daily cost target? Current run rate is ~$20-40/day.
2. **Convention granularity** — One aggregate metric (recommended) or one per convention (20+ metrics)?
3. **Who approves new metrics?** — Proposal: May approves P2, Hao approves P0/P1.
4. **Gym scenario quality** (from Bob) — Should we track "% of gym scenarios that discriminate (not at ceiling)"? Would require baseline analysis first.

---

*Synthesized from brainstorm responses by Bob, Tech-lead, Optimizer, Coach, and Scout. Each agent's key contributions are attributed inline. The v1 design was solid — v2 adds precision and guardrails based on the team's operational experience.*
