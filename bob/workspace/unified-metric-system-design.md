# Design Proposal: Unified Metric System

**Author:** Bob (Architect)  
**Date:** 2026-04-15  
**Status:** PROPOSAL — for Hao's review  
**Request:** req:cc18d652, req:f8aac33f  
**Prior art:** May's draft at `agents/shared/may-agent-docs/design/metrics-system.md`

---

## Executive Summary

The system has 8+ disconnected tracking mechanisms (request DB, dispatch board, improvement queue, cron health, experiments, skills, convention compliance, gym runs). No single view answers "how is the system doing?" This proposal defines a unified metric system stored in `may.db` that consolidates tracking into one queryable store with agent ownership, automatic measurement, and supervisory dashboards.

**Key recommendation:** Extend `may.db` with two core tables (`metrics` + `metric_snapshots`), a lightweight snapshot cron handler, and a phased migration that replaces the dispatch board with a generated view. Keep it simple — the value is in consolidation, not in building a metrics platform.

---

## 1. The Problem in Detail

| System | What it tracks | Format | Update cadence | Who reads it |
|--------|---------------|--------|----------------|-------------|
| Request DB (`requests` table) | 27,759 ad-hoc tasks | SQLite rows | Per-request | May, all agents |
| Dispatch board (`dispatch-board.md`) | May's ~15 active priorities | Markdown table | Every May heartbeat (~30min) | May, Hao |
| Improvement queue (`improvement-queue.md`) | Idle-time work items | Markdown checklist | Sporadic | May |
| Cron job health | Process monitoring | Watchdog handler logs | Per-heartbeat | May |
| Experiments (`experiments` table) | 141 experiments | SQLite rows | On sync | Bob, coach |
| Gym runs (`gym_runs` table) | 1,424 runs / 295 scenarios | SQLite rows | On run | Coach, coder |
| Convention compliance (`convention_checks` table) | 76,953 checks | SQLite rows | Per-evaluation | May, coach |
| Evaluations (`evaluations` table) | 21,884 session evals | SQLite rows | Per-session | Optimizer, May |

**The core issue:** Half is in SQLite (queryable, structured), half is in markdown (human-readable but not queryable). Goals don't drive work because they're scattered. No trend visibility. No anomaly detection. Agents discover work through different channels depending on what kind of work it is.

---

## 2. Common Metric Format

Every tracked goal becomes a **metric** with this shape:

| Field | Type | Description |
|-------|------|-------------|
| `id` | TEXT PK | Stable identifier, e.g. `quality.coder`, `fix-verify-wrap` |
| `name` | TEXT | Human-readable name |
| `type` | TEXT | `one-off` \| `continuous` \| `health` |
| `owner` | TEXT | Agent name responsible for driving it |
| `current` | REAL | Latest measured value |
| `target` | REAL | Goal value (1.0 for one-off = done) |
| `threshold` | REAL | For health metrics: alert if below this |
| `unit` | TEXT | `%`, `$`, `count`, `score`, null for binary |
| `status` | TEXT | `active` \| `blocked` \| `done` \| `paused` |
| `source` | TEXT | `auto` \| `manual` — how the value gets measured |
| `source_query` | TEXT | SQL query for auto-measured metrics |
| `priority` | TEXT | `P0` \| `P1` \| `P2` — explicit priority (see §2.1) |
| `created_at` | INTEGER | Epoch ms |
| `updated_at` | INTEGER | Epoch ms |
| `closed_at` | INTEGER | When status → `done` |

### 2.1 On Priority: Gap vs. Explicit

May's draft proposes "the gap between current and target IS the priority." This is elegant but breaks in practice:

- A metric at 55% with target 70% (15pp gap) may be less urgent than a metric at 0/1 (binary blocker).
- Health metrics below threshold all have the same "gap" semantics but different urgency (2% below threshold vs. 30% below).
- Some goals are strategically important regardless of gap size (Hao's P0 priorities).

**Recommendation:** Keep an explicit `priority` field (`P0`/`P1`/`P2`) set by the metric creator. Agents sort by `priority` first, then by gap-to-target within each priority band. May can override priority at any time. This matches the existing P0/P1/P2 pattern used throughout the system (requests, dispatch board).

### 2.2 The Three Metric Types

| Type | Lifecycle | Agent behavior | Example |
|------|-----------|---------------|---------|
| **One-off** | Receive → Execute → Done | Fork work, mark complete | "Fix verify-wrap bug" |
| **Continuous** | Diagnose → Act → Measure → Iterate | Persistent-task loop | "Improve coder quality 0.75 → 0.90" |
| **Health** | Monitor → Alert on threshold breach → Fix → Resume | Act only when below threshold | "Heartbeat success rate > 99%" |

One-off metrics auto-close when `current >= target`. Health metrics never close — they're perpetual monitors. Continuous metrics close when the owner proposes closure and May confirms.

---

## 3. Storage: Extend `may.db`

### 3.1 Why `may.db`, not filesystem

| Option | Pros | Cons |
|--------|------|------|
| **Extend `may.db`** (recommended) | Queryable, joins with existing tables, atomic writes, trend queries trivial | Another table to maintain |
| New `metrics.db` | Isolation | Agents already have `may.db` access; adding a second DB is unnecessary complexity |
| Filesystem (markdown/JSON) | Human-readable | Not queryable, no joins, no trend analysis, git noise from frequent updates |
| Hybrid (markdown + SQLite) | Readable + queryable | Two sources of truth = guaranteed drift |

**Decision: Extend `may.db`.** All the data sources we're consolidating (evaluations, conventions, gym runs, experiments) are already in `may.db`. Adding metrics tables keeps everything in one place. The dispatch board becomes a generated view, not a manually-edited file.

### 3.2 Schema

```sql
-- Metric registry — what we're tracking
CREATE TABLE IF NOT EXISTS metrics (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('one-off', 'continuous', 'health')),
  owner       TEXT NOT NULL,
  current     REAL,
  target      REAL NOT NULL,
  threshold   REAL,
  unit        TEXT,
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'blocked', 'done', 'paused')),
  priority    TEXT DEFAULT 'P1' CHECK (priority IN ('P0', 'P1', 'P2')),
  blocker     TEXT,
  source      TEXT DEFAULT 'manual' CHECK (source IN ('auto', 'manual')),
  source_query TEXT,
  tags        TEXT,               -- JSON array for grouping: ["research", "quality"]
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  closed_at   INTEGER
);

-- Time-series measurements
CREATE TABLE IF NOT EXISTS metric_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id   TEXT NOT NULL REFERENCES metrics(id),
  value       REAL NOT NULL,
  measured_at INTEGER NOT NULL,
  measured_by TEXT,               -- 'auto:metrics-snapshot' or 'manual:coach'
  note        TEXT
);

CREATE INDEX IF NOT EXISTS idx_snapshots_metric
  ON metric_snapshots(metric_id, measured_at);
CREATE INDEX IF NOT EXISTS idx_metrics_owner
  ON metrics(owner, status);
CREATE INDEX IF NOT EXISTS idx_metrics_status
  ON metrics(status);
```

### 3.3 Why No Alerts Table

May's draft includes a `metric_alerts` table. I recommend **against** this initially:

- Alerts are ephemeral — they matter at the moment of detection, then they're resolved.
- The snapshot handler can log alerts to `activity.jsonl` or send a direct message to the owner agent.
- Adding an alerts table creates a third thing to query and manage before we know if alerts are useful.
- If we later find we need alert history, we can add the table. Starting without it is cheaper than removing it.

**Recommendation:** Phase 1 has no alerts table. Threshold breaches are detected by the snapshot handler and dispatched as messages to the owning agent. If we find we need alert history after 2 weeks of operation, add the table then.

---

## 4. How Agents Own and Drive Metrics

### 4.1 Discovery: "What do I own?"

Each agent queries their metrics at heartbeat start:

```sql
SELECT id, name, type, current, target, threshold, status, blocker, priority
FROM metrics
WHERE owner = ? AND status IN ('active', 'blocked')
ORDER BY priority ASC, (target - COALESCE(current, 0)) / target DESC
```

This returns metrics sorted by priority (P0 first), then by relative gap (worst-performing first within each priority band). The query replaces reading `todo.md`, checking dispatch board, and scanning improvement queue.

**Key design choice:** Metrics discovery is **pull-based**. Agents query their own metrics. May doesn't need to push assignments. Ownership IS the assignment mechanism.

### 4.2 Execution Patterns by Type

**One-off metrics:**
```
Heartbeat reads: "fix-verify-wrap" → current=0, target=1, status=active
Agent forks a work session to fix the bug
Work session completes → writes: UPDATE metrics SET current=1, status='done', closed_at=? WHERE id='fix-verify-wrap'
```

**Continuous metrics:**
```
Heartbeat reads: "quality.coder" → current=0.75, target=0.90, priority=P1
Agent checks: is there a persistent-task project for this? 
  If no → create one: agents/coach/workspace/projects/metric-quality-coder.md
  If yes → fork next iteration of the persistent-task
Snapshot handler auto-updates current value from source_query next cycle
```

**Health metrics:**
```
Heartbeat reads: "health.error-rate" → current=0.8%, threshold=2%
current < threshold? No → skip (healthy)
If yes → fork a diagnostic session to find and fix the cause
```

### 4.3 Push vs. Pull — The Hybrid Answer

| Mechanism | What | Who |
|-----------|------|-----|
| **Pull** (agent queries DB) | Discovery of owned metrics | All agents, at heartbeat start |
| **Pull** (cron queries DB) | Auto-measurement of `source='auto'` metrics | Snapshot handler |
| **Push** (agent writes DB) | Manual measurement, status updates, one-off completion | Owning agent |
| **Push** (May writes DB) | Metric creation, reassignment, priority changes, blocking | May |

This is not purely push or purely pull — it's pull for reading, push for writing. The DB is the single source of truth. No polling, no event bus, no pubsub. SQLite handles all the coordination.

---

## 5. How Metrics Get Created and Retired

### 5.1 Creation Paths

| Creator | Mechanism | Example |
|---------|-----------|---------|
| **Hao** (direct) | May inserts into `metrics` table per Hao's request | "Track coder quality, target 0.90, owner coach" |
| **May** (supervisory) | May identifies a gap in monitoring and creates a metric | "Convention C1.1 compliance dropping — create health metric" |
| **Agent** (proposes) | Agent messages May: "I think we should track X" → May reviews and creates if approved | "Bob proposes tracking hypothesis conclusion rate" |
| **Auto** (from requests) | When Hao sends a significant request, May can optionally create a one-off metric to track it | Request → metric with `source='manual'` |

**Who can INSERT?** Only May and Hao. Agents propose, May creates. This prevents metric explosion (anti-pattern #1) and ensures consistent naming/ownership.

**Exception:** Auto-created metrics. The snapshot handler could auto-create health metrics for standard monitoring (error rates, heartbeat success) during initial setup. After that, all creation goes through May.

### 5.2 Retirement Paths

| Type | How it closes | Who closes |
|------|--------------|-----------|
| **One-off** | `current >= target` → auto-closed by snapshot handler | Automatic |
| **Continuous** | Owner proposes closure (target reached or goal abandoned) → May confirms | Owner + May |
| **Health** | Never closes — can be `paused` if the monitored thing is decommissioned | May |
| **Any** | Hao or May can set `status = 'paused'` or `status = 'done'` at any time | May/Hao |

**Stale metric detection:** The snapshot handler flags metrics with no snapshot movement in 48h as potentially stale. May reviews during heartbeat and either nudges the owner or pauses the metric.

---

## 6. May's Supervisory Dashboard

### 6.1 The Dispatch Board Becomes a View

Today's `dispatch-board.md` is manually edited markdown (~100 lines). It becomes a **generated view** from the metrics table:

```sql
-- May's dashboard query
SELECT
  m.id, m.name, m.type, m.owner, m.current, m.target, m.threshold,
  m.status, m.priority, m.blocker,
  -- Trend: compare current to 7-day-ago snapshot
  (SELECT s.value FROM metric_snapshots s
   WHERE s.metric_id = m.id
   AND s.measured_at < (strftime('%s','now')*1000 - 604800000)
   ORDER BY s.measured_at DESC LIMIT 1) as value_7d_ago,
  -- Last update
  m.updated_at
FROM metrics m
WHERE m.status IN ('active', 'blocked')
ORDER BY
  CASE m.priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 END,
  CASE m.type WHEN 'health' THEN 0 WHEN 'continuous' THEN 1 WHEN 'one-off' THEN 2 END,
  m.updated_at ASC
```

This produces a structured view that can be rendered as markdown (for digest/telegram), HTML (for web UI), or consumed directly by agents.

### 6.2 What May Monitors

May's heartbeat metric review replaces manual dispatch board editing:

1. **🔴 Blocked metrics** — status = 'blocked'. Can May unblock, or escalate to Hao?
2. **🔴 Health breaches** — current < threshold. Nudge owner or fork a fix.
3. **📉 Regressions** — current < previous snapshot. Something broke; alert owner.
4. **⏸ Stalled** — no snapshot movement in 48h, status still 'active'. Nudge owner.
5. **🤷 Unowned** — owner agent is down (amy-kimi). Reassign or mark blocked.
6. **✅ Recently completed** — clean up, archive, report to Hao.

### 6.3 Generated Dashboard Format

The snapshot handler (or a separate digest handler) generates a summary:

```markdown
## Metric Dashboard — 2026-04-15 14:00 UTC
### 🔴 Blocked (2)
| Metric | Owner | Blocker |
|--------|-------|---------|
| ops.amy-kimi | may | Billing — waiting on Hao |
| ops.prompt-caching | tech-lead | Need ANTHROPIC_API_KEY |

### 📈 Active — Continuous (3, sorted by gap)
| Metric | Owner | Current | Target | 7d Trend |
|--------|-------|---------|--------|----------|
| quality.coder | coach | 0.75 | 0.90 | ↑0.02 |
| gym.pass-rate | coach | 56% | 70% | ↑1.2% |
| research.hypotheses-concluded | bob | 35% | 80% | ↑5% |

### 🏥 Health — Below Threshold (1)
| Metric | Owner | Current | Threshold |
|--------|-------|---------|-----------|
| health.heartbeat-success | may | 88% | 99% |

### ✅ Done This Week (4)
fix-verify-wrap, output-channel-phase1, scenario-oracle, pivot-detector-guard
```

---

## 7. Consolidation: Mapping Existing Systems

### 7.1 What Becomes a Metric

| Current system | Maps to | Notes |
|---------------|---------|-------|
| Dispatch board active items | Individual metrics with appropriate types | Board becomes the generated view |
| Improvement queue items | One-off metrics owned by the assigned agent | Remaining queue items become metrics |
| Convention compliance (aggregate) | Health metric: `convention.aggregate` | `source_query` against `convention_checks` |
| Convention compliance (per-convention) | Only create if aggregate drops below threshold | Avoid metric explosion |
| Gym pass rate | Continuous metric: `gym.pass-rate` | `source_query` against `gym_runs` |
| Agent quality scores | Continuous metrics: `quality.<agent>` | `source_query` against `evaluations` |
| Daily cost | Health metric: `cost.daily` | `source_query` against `evaluations.usage` |
| System error rate | Health metric: `health.error-rate` | `source_query` against `sessions` |
| Experiment completion | **Don't migrate** — experiments have their own tracking | See §7.2 |
| Cron job health | Health metric: `health.cron-success` | `source_query` against `sessions` for cron kinds |

### 7.2 What Does NOT Become a Metric

- **Individual requests** — 27K+ rows in `requests`. These are tasks, not goals. Don't create a metric per request.
- **Individual experiments** — 141 experiments with their own status tracking. Don't duplicate.
- **Individual hypotheses** — Same reasoning. The research system has its own lifecycle.
- **Historical data** — No backfilling. Metrics track goals going forward.

The boundary: **Metrics track aggregate goals. Details stay in their source tables.** A metric like `research.hypotheses-concluded` is an aggregate that queries the `hypotheses` table — it doesn't replace it.

### 7.3 The Dispatch Board Transition

Today: May manually reads and edits `dispatch-board.md` every heartbeat (~10 ops).
After: May queries the `metrics` table (~2 ops). The dashboard is regenerated by the snapshot handler.

**Migration plan:**
1. Create metrics for every current "Active Items" row in `dispatch-board.md`
2. Update May's heartbeat to query `metrics` instead of reading the board
3. Keep `dispatch-board.md` as a **read-only generated file** for Hao's convenience during transition
4. After 1 week of stable operation, stop generating the markdown file

---

## 8. Initial Metric Set

### Auto-measured (from existing DB data)

| ID | Type | Owner | Source Query (simplified) | Target |
|----|------|-------|--------------------------|--------|
| `quality.coder` | continuous | coach | AVG(quality) FROM evaluations WHERE agent='coder' (24h) | 0.90 |
| `quality.system` | health | may | AVG(quality) FROM evaluations (24h) | > 0.85 |
| `cost.daily` | health | may | SUM(cost) FROM evaluations (24h) | < $50 |
| `gym.pass-rate` | continuous | coach | passed/total FROM gym_runs (7d) | 70% |
| `convention.aggregate` | health | may | pass rate FROM convention_checks (7d) | > 90% |
| `health.error-rate` | health | may | error sessions / total (24h) | < 2% |
| `research.experiments-completed` | continuous | bob | COUNT(*) FROM experiments WHERE status='completed' | 150 |
| `research.hypotheses-concluded` | continuous | bob | concluded/total FROM hypotheses | 80% |

### Manual (seeded by Hao/May)

| ID | Type | Owner | Current | Target |
|----|------|-------|---------|--------|
| `ops.amy-kimi` | health | may | 0 | 1 |
| `ops.prompt-caching` | one-off | tech-lead | 0 | 1 |
| `infra.persistent-task-adoption` | continuous | tech-lead | 1 | 10 |

**Total initial set: ~11 metrics.** This is deliberately small. Grow organically as agents and Hao identify new goals worth tracking.

---

## 9. The Snapshot Handler

**Location:** `agents/may/handlers/metrics-snapshot.ts`  
**Cron interval:** Every 1 hour  
**Estimated size:** ~150 LOC

Responsibilities:
1. Run `source_query` for all `source='auto'` active metrics → record snapshots → update `current`
2. Auto-close one-off metrics where `current >= target`
3. Detect health threshold breaches → message the owning agent
4. Detect stalled metrics (no movement in 48h) → flag for May's review
5. Optionally: regenerate a dashboard markdown file

**Not** responsible for: measuring manual metrics, creating new metrics, assigning ownership.

### Cost analysis

- 11 initial metrics × 1 SQL query each × 24 times/day = 264 queries/day
- Each query is a lightweight aggregate over indexed columns
- Zero LLM cost — this is pure JS/SQL
- Snapshot rows: 11 × 24 = 264 rows/day, ~96K rows/year — trivial for SQLite

---

## 10. Tradeoffs and Design Decisions

### 10.1 Metric Granularity: Aggregate vs. Per-Entity

**Question:** One metric `convention.aggregate` or 20+ metrics `convention.c1.1`, `convention.c1.2`, etc.?

**Recommendation:** Start with aggregates. Create per-entity metrics only when the aggregate breaches its threshold and you need to diagnose which sub-metric is causing the problem. This keeps the metric count low (~10-20) rather than exploding to 50+.

**Tradeoff:** You lose per-entity trend visibility until you drill down. But agents can always query the source tables directly for diagnosis — the metric system doesn't need to replicate all detail.

### 10.2 Metric Creation Control

**Question:** Should any agent be able to INSERT into `metrics`, or only May?

**Recommendation:** Only May (and Hao via May). This prevents:
- **Metric explosion** — agents creating metrics for every small task
- **Naming conflicts** — two agents creating `quality.coder` with different definitions
- **Orphan metrics** — metrics created but never measured or closed

**Tradeoff:** Agents can't self-organize around metrics they discover. But the proposal-via-message flow is lightweight enough (agent messages May, May reviews next heartbeat, creates if worthwhile).

### 10.3 Auto-close vs. Manual Close

**Question:** Should one-off metrics auto-close when `current >= target`?

**Recommendation:** Yes, for `source='auto'` metrics. For `source='manual'`, require the owner to explicitly mark done (they have context on whether the work is truly complete).

**Tradeoff:** Auto-close might prematurely close a metric if the source query gives a false positive. Mitigation: the snapshot handler logs closures, and May reviews recently-closed metrics each cycle.

### 10.4 Dispatch Board: Kill or Keep?

**Question:** Should `dispatch-board.md` be replaced entirely, or kept as a generated artifact?

**Recommendation:** Keep it as a generated read-only file during a 2-week transition period, then deprecate. The markdown file is useful for Hao who reads it directly. But May should stop editing it manually — all state lives in the DB.

**Tradeoff:** During transition, there are two sources of truth. Mitigate by having the generated file include a prominent header: "⚠️ AUTO-GENERATED from metrics table. Do not edit."

### 10.5 Relationship to Persistent Tasks

Persistent tasks are the **execution mechanism**. Metrics are the **tracking mechanism**. They're complementary:

| Persistent Task | Metric System |
|----------------|---------------|
| Project file with goal | Metric target |
| Each iteration | One action toward target |
| Owner review | Measuring whether metric moved |
| Project status | Metric status |

A continuous metric can optionally have a `project` field pointing to its persistent-task project file. The metric tells you WHAT to push; the persistent task tells you HOW.

---

## 11. What This Doesn't Do

To keep scope bounded, this design explicitly excludes:

1. **Dashboard UI** — No web UI changes. The data is queryable; UI can come later.
2. **Metric visualization** — No charts, graphs, or trend lines. Trend is just `current` vs. `value_7d_ago` in a query.
3. **Automated goal-setting** — Targets are set by humans (Hao/May). No ML-based target prediction.
4. **Cross-agent metric dependencies** — No "metric X depends on metric Y." Keep it flat.
5. **SLA/deadline tracking** — No "this metric must reach target by date X." Could be added later as a `deadline` column.
6. **Notification routing** — Threshold breaches generate messages via existing `agents.message()`. No new notification system.

---

## 12. Implementation Phases

### Phase 1: Schema + Snapshot Handler + Seed Data (~200 LOC, 1 session)
- Create `metrics` and `metric_snapshots` tables in `may.db`
- Build `metrics-snapshot.ts` handler with auto-measurement
- Add cron entry (1h interval)
- Seed the ~11 initial metrics from §8
- **Validation:** Run the handler once, verify snapshots are recorded correctly

### Phase 2: Agent Discovery Integration (~50 LOC, 1-2 sessions)
- Add "my metrics" query to `system_status` tool output
- Update May's heartbeat to query metrics table instead of scanning dispatch board
- Generate dispatch board from metrics (read-only markdown)
- **Validation:** May's heartbeat uses metric data for follow-up decisions

### Phase 3: Agent Heartbeat Updates (0 LOC — context.md edits only)
- Add to each agent's `context.md`: "Check your metrics at heartbeat start: `SELECT * FROM metrics WHERE owner = '...'`"
- This is a data change, not a code change (per code-vs-data-decisions.md)
- **Validation:** Agents reference their metrics in heartbeat sessions

### Phase 4: Board Deprecation + Organic Growth (ongoing)
- Stop generating `dispatch-board.md`
- Agents propose new metrics as they identify goals
- May manages lifecycle (creation, closure, priority changes)
- Review target values quarterly

---

## 13. Open Questions for Hao

1. **Cost target** — What's the right `cost.daily` target? Current run rate is ~$20-40/day. Recommend $50 as the health threshold (alert above this), with a stretch target of $30.

2. **Quality targets** — `quality.coder` at 0.90 is aspirational. Current evaluator quality scores may not be well-calibrated (EXP-109 raised questions about evaluator reliability). Should we set conservative targets and tighten later?

3. **Who creates the initial set?** — I recommend May seeds auto-measured metrics from existing DB data after this design is approved. Hao approves the target values (especially cost and quality targets).

4. **Agent heartbeat changes** — Updating every agent's heartbeat to "check metrics first" is a behavioral change. Per KE-008, we should not restructure heartbeat steps. Recommend adding metrics as a data source within existing observation steps rather than creating a new step.

5. **Dispatch board transition timing** — Is Hao comfortable with the board becoming auto-generated? Or does Hao want to keep manual control of what's on the board?

6. **Metric tool?** — Should we add a `metrics` tool to the agent toolset (like `finish()` or `checkpoint()`), or is raw SQL in bun sufficient? Raw SQL for Phase 1, consider a tool if agents struggle with the queries.

---

## Appendix A: Comparison with May's Draft

May's existing design at `agents/shared/may-agent-docs/design/metrics-system.md` is thorough (~350 lines) and covers the same territory. My proposal aligns with it on:
- Schema design (two tables, same core fields)
- Snapshot handler approach
- Agent discovery via SQL query
- Phased implementation

Where this proposal diverges:
| Topic | May's draft | This proposal | Rationale |
|-------|------------|---------------|-----------|
| Priority | "Gap IS priority" — no priority field | Explicit `P0`/`P1`/`P2` field | Gap-as-priority breaks for mixed types; explicit matches existing system patterns |
| Alerts table | Includes `metric_alerts` table | No alerts table in Phase 1 | YAGNI — add if needed after 2 weeks |
| Tags | Not included | `tags` field (JSON array) | Enables grouping: "show me all research metrics" without naming conventions |
| Metric creation | Anyone can propose | Only May/Hao can INSERT | Prevents explosion and naming conflicts |
| Board deprecation | Immediate replacement | 2-week transition with generated read-only board | Reduces risk of losing visibility during transition |

## Appendix B: Example Queries Agents Would Run

**Coach heartbeat — "What should I work on?"**
```sql
SELECT id, name, current, target, priority
FROM metrics
WHERE owner = 'coach' AND status = 'active'
ORDER BY priority, (target - COALESCE(current, 0)) DESC
LIMIT 5
```

**May dashboard — "System health at a glance"**
```sql
SELECT id, name, owner, current, threshold,
  CASE WHEN current < threshold THEN '🔴' ELSE '🟢' END as health
FROM metrics
WHERE type = 'health' AND status = 'active'
ORDER BY (current - threshold) ASC  -- worst first
```

**Trend query — "How has coder quality changed this week?"**
```sql
SELECT date(measured_at/1000, 'unixepoch') as day, round(avg(value), 3) as avg_quality
FROM metric_snapshots
WHERE metric_id = 'quality.coder'
  AND measured_at > (strftime('%s', 'now') * 1000 - 604800000)
GROUP BY day
ORDER BY day
```

**Stale detection — "Which metrics haven't moved?"**
```sql
SELECT m.id, m.name, m.owner, m.current, m.target,
  (strftime('%s','now')*1000 - m.updated_at) / 3600000 as hours_stale
FROM metrics m
WHERE m.status = 'active' AND m.type = 'continuous'
  AND m.updated_at < (strftime('%s','now')*1000 - 172800000)  -- 48h
ORDER BY hours_stale DESC
```
