# Unified Metric System — Consolidated Proposal

**Status:** PROPOSAL — for Hao approval  
**Date:** 2026-04-15  
**Author:** Bob (synthesizing input from all 5 agents + May's draft)  
**Inputs:** Bob, Tech-Lead, Optimizer, Coach, Scout brainstorm responses + May's `metrics-system.md` draft

---

## 1. Executive Summary

The metric system gives every agent a concrete, queryable answer to "what should I work on?" by replacing scattered tracking (dispatch board, todo.md, ad-hoc queries) with a single `metrics` table in `may.db`. Each metric has an **owner**, a **current value**, a **target**, and a **type** (one-off, continuous, or health). A snapshot handler auto-measures what it can via SQL or shell commands; agents manually record the rest. Existing systems (request DB, dispatch board, improvement queues) continue running in parallel — metrics don't replace them, they provide a unified overlay. The lifecycle is simple: **create → track → retire → archive**. A dashboard on the web console surfaces all active metrics, with human-confirmed ones (Hao-created) at the top.

---

## 2. Common Themes Across All Agents

### 2.1 Universal Agreement (all 5 agents)
- **Minimal heartbeat changes.** Everyone said the same thing: add a metrics query to the existing observation step, don't restructure heartbeat flow (per KE-008). Metrics inform task selection; they don't replace it.
- **Metrics inform, don't dictate.** Bob, Tech-Lead, and Coach all explicitly warned against replacing judgment with "work on worst metric." Research benefits from serendipity, lenses catch things metrics miss, interventions require nuance. The metric with the biggest gap is a *tiebreaker*, not a mandate.
- **Keep it small at launch.** Tech-Lead: "start with 8-10 metrics, not 30." Everyone proposed 3-5 metrics each, totaling ~20. That's the right order of magnitude.

### 2.2 Strong Agreement (4/5 agents)
- **Explicit priority field, not gap-as-priority.** Bob, Tech-Lead, Optimizer, and Coach all rejected the draft's "gap to target IS priority" approach. Gap comparison across different units (%, score, count) is meaningless. A P0/P1/P2 field is simpler and matches how agents already think. (Scout didn't mention it — no objection.)
- **Filesystem outputs aren't queryable via SQL.** Bob, Scout, and Tech-Lead flagged that hypotheses, knowledge entries, deep dives, and skills live in git as markdown files, not in `may.db`. The design needs a story for non-SQL measurement.

### 2.3 Notable Individual Insights
- **Coach: Sample size on snapshots.** A quality score from 3 sessions is noise; from 50 is signal. Snapshots should record `n` alongside `value`.
- **Coach: Intervention tracking.** When a metric moves, was it the skill I promoted or a coincidence? Need structured way to annotate "intervention X deployed at time T."
- **Optimizer: Sensitivity/min_delta for alerts.** Efficiency metrics fluctuate ±10% daily. Don't fire alerts on every single-snapshot dip — require meaningful regression (e.g., >15% from 7-day average).
- **Scout: research_log table.** A lightweight table where filesystem-based agents INSERT a row per output, making their work SQL-queryable.
- **Tech-Lead: source_command for shell-based metrics.** `tsc --noEmit`, `git branch`, `vitest --run` — infra health needs shell commands, not SQL.

---

## 3. Metric Catalog

### 3.1 May (System Oversight)

| ID | Name | Type | Measurement | Cadence | Why It Matters |
|----|------|------|-------------|---------|----------------|
| `quality.system` | System avg quality | health | Auto: `AVG(quality)` from evaluations (24h) | 1h | Top-level quality signal |
| `cost.daily` | Daily total cost | health | Auto: `SUM(cost)` from evaluations (24h) | 1h | Cost control |
| `convention.aggregate` | Convention compliance | health | Auto: overall pass rate from convention_checks (7d) | 1h | System discipline |
| `health.error-rate` | System error rate | health | Auto: error sessions / total (24h) | 1h | Operational health |
| `health.heartbeat-success` | Heartbeat success rate | health | Auto: completed heartbeats / total (24h) | 1h | Agent liveness |

**Note:** May owns system-level health. Individual convention metrics (C1.1, C1.2, etc.) are drilled into on breach, not tracked as separate metrics. (Coach agrees: May owns monitoring, Coach investigates on dispatch.)

### 3.2 Coach (Quality & Skills)

| ID | Name | Type | Measurement | Cadence | Why It Matters |
|----|------|------|-------------|---------|----------------|
| `quality.coder` | Coder quality score | continuous | Auto: `AVG(quality)` from evaluations WHERE agent='coder' (24h) | 1h | Core deliverable quality |
| `quality.bob` | Bob quality score | continuous | Auto: same pattern, agent='bob' | 1h | Research quality |
| `gym.pass-rate` | Gym pass rate | continuous | Auto: passed/total from gym_runs (7d) | 1h | Scenario discrimination |
| `skill.effectiveness` | Skill intervention success rate | continuous | Manual: after each growth cycle, record whether promoted skill moved the target agent's quality | Per growth cycle | Answers "are my interventions working?" |

### 3.3 Bob (Research)

| ID | Name | Type | Measurement | Cadence | Why It Matters |
|----|------|------|-------------|---------|----------------|
| `research.hypotheses-concluded` | Hypothesis conclusion rate | continuous | Hybrid: sync script greps Status from hypothesis files → SQL query | Weekly | Are we closing the loop on research? |
| `research.knowledge-entries` | Knowledge entries count | continuous | Hybrid: `find ... \| wc -l` or research_log table | Weekly | Is knowledge accumulating? |
| `research.experiments-velocity` | Experiments completed per week | health | Auto: COUNT from experiments WHERE completed in last 7d | 1h | Research velocity (not stock — see §5.1) |
| `research.gym-scenario-quality` | % of gym scenarios that discriminate | continuous | Hybrid: query gym baselines for ceiling scenarios | Monthly | Are our evaluation tools useful? |

**Note on Bob's original `experiments-completed` target of 150:** This is a stock metric that will be reached and auto-close. Replaced with velocity metric (health, threshold ≥ 2/week) which is perpetually useful.

### 3.4 Tech-Lead (Infrastructure)

| ID | Name | Type | Measurement | Cadence | Why It Matters |
|----|------|------|-------------|---------|----------------|
| `infra.persistent-task-adoption` | Projects using persistent-task | continuous | Manual: count during lens rotations | Weekly | Is the pattern spreading? |
| `infra.dead-code-ratio` | LOC removed / LOC added | continuous | Shell: git log --stat analysis | Weekly | Code health over time |
| `infra.review-branch-turnaround` | Avg hours from branch to merge | continuous | Shell: git branch age analysis | Daily | Branch hygiene |
| `health.tsc-clean` | Does tsc --noEmit pass? | health | Shell: `tsc --noEmit 2>&1 | grep -c error` | 1h | Type safety |
| `health.test-pass-rate` | Vitest pass rate | health | Shell: `vitest --run` result | 1h | Test health |
| `health.review-branch-count` | Unmerged review branches | health | Shell: `git branch -r --list 'review/*' \| wc -l` | 1h | Branch accumulation |

### 3.5 Optimizer (Efficiency)

| ID | Name | Type | Measurement | Cadence | Why It Matters |
|----|------|------|-------------|---------|----------------|
| `efficiency.ops-per-session` | System-wide avg ops/session (24h) | continuous | Auto: `AVG(opCount)` from sessions (24h) | 1h | Core efficiency KPI |
| `efficiency.daily-ops` | Total daily ops | health | Auto: `SUM(opCount)` from sessions (24h) | 1h | Direct cost proxy |
| `efficiency.tool-adoption` | Adoption rate of optimizer tools | continuous | Manual: sample sessions, count usage | Weekly | Are built tools being used? |
| `health.session-bloat` | % sessions >50 ops | health | Auto: SQL aggregate from sessions (24h) | 1h | Waste detection |
| `health.heartbeat-ops` | Avg heartbeat ops (system) | health | Auto: `AVG(opCount)` WHERE kind='heartbeat' (24h) | 1h | Heartbeat lean-ness |

### 3.6 Scout (Research — Library)

| ID | Name | Type | Measurement | Cadence | Why It Matters |
|----|------|------|-------------|---------|----------------|
| `research.dd-rate` | Deep dives per week | continuous | Hybrid: COUNT from research_log WHERE type='dd' (7d) | Daily | Core throughput |
| `research.hypothesis-generation` | Hypotheses proposed (cumulative) | continuous | Hybrid: COUNT from research_log WHERE type='hypothesis' | Weekly | Is research producing ideas? |
| `research.novelty-ratio` | % of DDs rated ★★★★+ | continuous | Manual: tag DDs with star ratings at write time | Weekly | Quality filter |
| `research.coverage-gap` | Days since last arXiv triage | health | Shell: `git log -1 -- papers.md` → days since | Daily | No gaps in scanning |
| `research.library-freshness` | Days since last INDEX.md update | health | Shell: `git log -1 -- INDEX.md` → days since | Daily | Stale index detection |

### Total: 29 metrics (6 agents × 4-6 each)

This is slightly above Tech-Lead's "8-10" suggestion, but many are auto-measured health metrics that require zero agent effort. Active continuous metrics requiring attention: ~12. That's manageable.

---

## 4. Architecture

### 4.1 Data Model

Three tables in `may.db`, extending May's draft with fields requested by agents:

```sql
CREATE TABLE IF NOT EXISTS metrics (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,               -- 'one-off' | 'continuous' | 'health'
  owner         TEXT NOT NULL,               -- agent name
  current       REAL,                        -- latest value
  target        REAL NOT NULL,               -- goal (1.0 for one-off)
  threshold     REAL,                        -- health metrics: alert if below
  unit          TEXT,                        -- '%', '$', 'count', 'score', 'days'
  priority      TEXT DEFAULT 'P1',           -- [NEW] P0 | P1 | P2 (explicit, not gap-derived)
  status        TEXT NOT NULL DEFAULT 'active',
  blocker       TEXT,
  project       TEXT,                        -- persistent-task project file path
  source        TEXT,                        -- 'auto' | 'manual' | 'hybrid'
  source_query  TEXT,                        -- SQL for auto-measured
  source_command TEXT,                       -- [NEW] shell command for non-SQL measurement
  measure_interval INTEGER,                  -- [NEW] expected hours between updates (staleness)
  sensitivity   REAL,                        -- [NEW] min % change to trigger alert (optimizer ask)
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  closed_at     INTEGER
);

CREATE TABLE IF NOT EXISTS metric_snapshots (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id     TEXT NOT NULL REFERENCES metrics(id),
  value         REAL NOT NULL,
  sample_size   INTEGER,                     -- [NEW] n for this measurement (coach ask)
  measured_at   INTEGER NOT NULL,
  measured_by   TEXT,                        -- 'auto:snapshot-handler' | 'manual:coach' etc.
  note          TEXT                         -- intervention annotations
);

CREATE TABLE IF NOT EXISTS metric_alerts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id     TEXT NOT NULL REFERENCES metrics(id),
  severity      TEXT NOT NULL,               -- 'red' | 'yellow'
  message       TEXT NOT NULL,
  value         REAL,
  threshold     REAL,
  created_at    INTEGER NOT NULL,
  resolved_at   INTEGER
);

-- Research output tracking (scout + bob ask)
CREATE TABLE IF NOT EXISTS research_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  type          TEXT NOT NULL,               -- 'dd', 'cr', 'hypothesis', 'triage', 'ke', 'experiment'
  ref           TEXT,                        -- 'DD#690', 'H-097', 'KE-186'
  agent         TEXT NOT NULL,
  rating        INTEGER,                     -- 1-5 stars (optional)
  created_at    INTEGER NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_snapshots_metric ON metric_snapshots(metric_id, measured_at);
CREATE INDEX IF NOT EXISTS idx_metrics_owner ON metrics(owner, status);
CREATE INDEX IF NOT EXISTS idx_metrics_status ON metrics(status);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON metric_alerts(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_research_log_type ON research_log(type, created_at);
```

### 4.2 New Fields (vs. May's draft)

| Field | Table | Requested By | Why |
|-------|-------|-------------|-----|
| `priority` | metrics | Bob, TL, Optimizer, Coach | Gap-as-priority fails across different units. P0/P1/P2 is simple and universal. |
| `source_command` | metrics | Tech-Lead | Infra health metrics need shell commands (`tsc`, `git`, `vitest`), not SQL. |
| `measure_interval` | metrics | Scout, Coach | Different metrics have different natural cadences. 48h stale detection is one-size-fits-all; weekly research metrics shouldn't trigger stale alerts after 2 days. |
| `sensitivity` | metrics | Optimizer | Efficiency metrics fluctuate ±10% daily. Alert only on meaningful regression (> sensitivity % from rolling average). |
| `sample_size` | metric_snapshots | Coach | A quality score from 3 sessions is noise; from 50 is signal. Track `n` alongside `value`. |
| `research_log` table | (new table) | Scout, Bob | Filesystem-based agents (research, knowledge) need SQL-queryable output tracking. Lightweight INSERT per output enables auto-measurement. |

### 4.3 Snapshot Handler

**File:** `agents/may/handlers/metrics-snapshot.ts`  
**Cron:** Every 1 hour  
**~200 LOC** (up from 150, adding source_command support)

Key additions to May's draft:

1. **Shell command execution**: For metrics with `source_command`, the handler runs the command and parses stdout as a number. Sandboxed — timeout after 10s, no write commands.
2. **Sensitivity-aware alerting**: Health alerts only fire when regression exceeds `sensitivity` threshold from 7-day rolling average (default: 0%, meaning any breach fires). Optimizer's metrics set sensitivity to 15%.
3. **Cadence-aware staleness**: Instead of hard-coded 48h, check `measure_interval` per metric. A weekly metric (168h interval) doesn't stale after 48h.
4. **Sample size recording**: For auto-measured metrics, include the COUNT alongside the AVG/SUM in the snapshot.
5. **Alert dedup**: Don't re-alert on the same metric while a previous alert is unresolved (Tech-Lead's ask). Only alert again after recovery + new regression.

### 4.4 Dashboard Display

Metrics surface on the web console via the proof-of-life digest. Format:

```
## Metrics Dashboard (29 active, 0 blocked, 0 done)

### 🔴 P0 — Needs Attention
[human-confirmed metrics first, then auto-flagged]

### 📈 P1 — Active Continuous
[sorted by owner, then gap-to-target within priority band]

### 🏥 Health (below threshold)
[only those currently breaching]

### ✅ Recently Completed (7d)
```

Human-confirmed metrics (Hao-created or Hao-escalated) display at top priority regardless of P-level.

### 4.5 Agent Heartbeat Integration

Every agent adds ONE query to their observation step:

```sql
SELECT id, name, type, current, target, threshold, priority, status
FROM metrics
WHERE owner = ? AND status IN ('active', 'blocked')
ORDER BY priority, (target - COALESCE(current, 0)) / NULLIF(target, 0) DESC
```

This is ~5 lines of output. The worst metric within the highest priority band informs task selection. It does NOT replace existing decision-making (lens rotation, serendipity, judgment). It's an additional data source.

### 4.6 Relationship to Existing Systems

| System | Status | How It Relates |
|--------|--------|---------------|
| Request DB | **Keeps running** | Tracks ad-hoc tasks. Not migrated to metrics. |
| Dispatch board | **Keeps running** | May can still edit it. Metrics provide parallel view. |
| Improvement queues | **Keep running** | Per-agent todo.md stays. Metrics overlay, not replace. |
| Persistent tasks | **Complementary** | Persistent-task = execution mechanism. Metric = tracking mechanism. |
| Experiments table | **Feeds metrics** | Auto-measured metrics query experiments table. |
| Convention checks | **Feeds metrics** | Auto-measured health metrics query convention_checks. |
| Gym runs | **Feeds metrics** | Auto-measured metrics query gym_runs. |

Per Hao's directive: **nothing gets retired in Phase 1.** Metrics run in parallel. If they prove more useful, agents will naturally migrate. Forced retirement causes disruption.

---

## 5. Implementation Plan

### Phase 1: Foundation (~250 LOC, 1-2 days)
1. Create tables in `may.db` (metrics, metric_snapshots, metric_alerts, research_log)
2. Build `metrics-snapshot.ts` handler with SQL + shell command support
3. Add cron entry (1h interval)
4. Seed initial metrics — the ~15 auto-measurable ones first (quality scores, costs, gym rate, convention compliance, efficiency)
5. Hao reviews and approves target values

### Phase 2: Agent Integration (~50 LOC each, 1 day)
1. Each agent adds metrics query to heartbeat observation step
2. Research agents (Bob, Scout) start INSERT-ing to `research_log` after work sessions
3. Tech-Lead builds seed-metrics.ts script for repeatable seeding

### Phase 3: Dashboard (~100 LOC, 1 day)
1. Add metrics section to `system_status` tool
2. Update proof-of-life digest to pull from metric_snapshots
3. Web console displays dashboard (Hao's ask)

### Phase 4: Refinement (ongoing)
1. Manual metrics recording helpers
2. Metric proposal flow (agent proposes → May reviews)
3. Intervention annotation tooling (Coach's ask)
4. Cross-metric dependency tracking (if needed)
5. Evaluate whether dispatch board / todo.md can be retired (not forced)

---

## 6. Open Questions for Hao

### 6.1 Cost Target
What's the right `cost.daily` threshold? Current run rate is ~$20-40/day. Need a number.

### 6.2 Convention Metric Granularity
One aggregate `convention.aggregate` metric (May's draft) or individual per-convention metrics? Agents prefer aggregate + drill-down on breach. Is that acceptable?

### 6.3 Who Sets Targets?
May seeds auto-measured metrics with proposed targets. Does Hao want to approve each target, or trust agent-proposed targets with Hao override rights?

### 6.4 Metric Creation Authority
Can agents create metrics directly, or must all go through May → Hao approval? Proposed: agents can create P2 metrics for themselves; P0/P1 require May approval.

### 6.5 research_log Table
Scout and Bob propose a `research_log` table for filesystem-based output tracking. This is ~20 lines of schema. Approve for Phase 1, or defer?

### 6.6 Dashboard Priority
Hao wants metrics on web console. How soon? If Phase 1 priority, Tech-Lead needs to know. If Phase 3, we can iterate on the data model first.

### 6.7 Metric Tool vs. Raw SQL
Should we add a `metrics` tool to the agent toolset (cleaner API, harder to misuse), or is raw SQL sufficient for Phase 1? Agents didn't request a tool — raw SQL works.

---

## Appendix A: Agent-by-Agent Heartbeat Changes

All agents agreed: **add within existing steps, don't restructure** (KE-008).

| Agent | Change | Where |
|-------|--------|-------|
| May | Query all active metrics → stalled/blocked/regressing triage | Observation step |
| Coach | Query owned metrics → worst gap drives growth cycle target | Step 1 (OBSERVE) |
| Bob | Query owned metrics → gap informs synthesis/hypothesis choice | Step 1 (read pending) |
| Tech-Lead | Query owned metrics → informs lens/feature prioritization | Observation step |
| Optimizer | Query owned metrics → worst metric drives exploration mode | Observation step |
| Scout | Query owned metrics → tiebreaker for task selection | Step 1 (OBSERVE) |

## Appendix B: Disagreements Resolved

| Topic | Positions | Resolution |
|-------|-----------|------------|
| Gap-as-priority vs. explicit P-level | Draft: gap is priority. 4/5 agents: explicit P0/P1/P2. | **Explicit priority field.** Gap is secondary sort within priority band. |
| Alert table in Phase 1 | Optimizer: skip it. May's draft: include it. | **Include it** — it's 10 lines of schema and prevents re-implementing alert logic later. But no alert table UI in Phase 1. |
| Retire dispatch board | May's draft: replace with generated view. Hao: don't retire existing mechanisms. | **Keep both.** Dispatch board stays. Metrics run in parallel. Retirement is Phase 4+ if metrics prove superior. |
| Filesystem measurement | Bob: sync script. Scout: research_log table. TL: source_command. | **All three, different use cases.** `source_command` for shell metrics (TL). `research_log` for output tracking (Scout/Bob). Sync scripts as needed for complex cases. |

## Appendix C: Risks

1. **Goodhart's Law** (Bob): If agents optimize for metric numbers, quality drops. Mitigation: metrics inform judgment, don't replace it. Coach's `skill.effectiveness` tracks whether interventions actually work, not just whether numbers move.
2. **Metric explosion** (Tech-Lead): Starting with 29 metrics is a lot. Mitigation: 17 are auto-measured health metrics requiring zero effort. Only 12 are continuous metrics requiring active work.
3. **Alert fatigue** (Tech-Lead, Optimizer): Noisy alerts train agents to ignore them. Mitigation: sensitivity field, dedup, cadence-aware staleness.
4. **Evaluator reliability** (Coach): Quality scores depend on evaluator calibration. If evaluator changes, historical metrics shift. Mitigation: `sample_size` on snapshots + `note` field for "evaluator updated" annotations.
5. **Over-measurement overhead**: Agents spending heartbeats managing metrics instead of doing work. Mitigation: one SQL query per heartbeat. If it takes more than 5 lines of output, we have too many metrics.
