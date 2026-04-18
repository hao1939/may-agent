# Design: Metrics & Constraints for Heartbeat-as-Dispatcher Pattern

**Author:** Optimizer · **Date:** 2026-04-05 · **Status:** Design proposal

## 1. Current State (Empirical)

Data from `.state/may.db`, 7-day window (2026-03-29 to 2026-04-05).

### Session Volume
| Kind | Count | Avg Ops | Avg Duration | Errors |
|------|-------|---------|-------------|--------|
| job (root) | 1064 | 17.7 | 20.4 min | 100 |
| call (child) | 19 | 17.2 | 6.5 min | 3 |
| chat | 2 | 5.5 | 70.5 min | 0 |

### Cron vs Task Sessions
| Agent | Cron | Tasks (Hao) | Total | Error Rate |
|-------|------|-------------|-------|------------|
| may | 160 | 11 | 171 | 2.9% |
| coach | 138 | 30 | 168 | 7.7% |
| bob | 132 | 29 | 161 | 9.9% |
| optimizer | 125 | 19 | 144 | 12.5% |
| qa | 126 | 0 | 126 | 4.0% |
| amy-kimi | 116 | 1 | 117 | 3.4% |
| tech-lead | 38 | 35 | 73 | 41.1% |
| scout | 52 | 2 | 54 | 22.2% |

**Key finding:** 918 of 1085 sessions (84.6%) are cron/heartbeat. Only 167 (15.4%) are direct tasks.

### Parent-Child Relationships
Only 50 child sessions in 7 days (4.6%). All from just 2 agents:
- may → tech-lead: 29 (23 job + 6 call)
- coach → coach: 21 (8 job + 13 call)

**No agent currently uses fork for dispatching work.**

### Heartbeat Efficiency
| Agent | Cron Avg Turns | Cron Avg Cost | Task Avg Turns | Task Avg Cost |
|-------|---------------|---------------|----------------|---------------|
| bob | 39.1 | $2.91 | 15.3 | $0.68 |
| optimizer | 38.3 | $2.33 | 31.1 | $1.54 |
| coach | 31.4 | $1.83 | 34.3 | $2.00 |

Bob's heartbeats are **4.3x more expensive** than his task sessions. Optimizer heartbeats use 38 turns avg — consistently hitting the 40-turn limit.

### Error Patterns (Cron)
| Error Type | Count |
|-----------|-------|
| Turn limit 41/40 | 45 |
| Turn limit 31/30 | 14 |
| Timeout | 7 |
| API 400/429 | 8 |
| Other | 3 |

**76.6% of cron errors are turn limit hits** — agents trying to do too much in one session.

### Interval Reality
| Agent | Config Interval | Actual Median Gap |
|-------|----------------|-------------------|
| bob | 60 min | 88 min |
| coach | 60 min | 60 min |
| optimizer | 60 min | 77 min |

Actual gaps are wider than configured because sessions overlap with the interval.

---

## 2. Measurement Framework

### 2.1 Session-Level Metrics

```sql
-- M1: Heartbeat duration (target: <5min for dispatchers)
SELECT agent,
  CASE WHEN (task LIKE '%[heartbeat]%' OR task LIKE '%[cron:%') THEN 'cron' ELSE 'task' END as type,
  AVG(CAST((endedAt - startedAt) AS FLOAT)/1000/60) as avg_min,
  percentile(CAST((endedAt - startedAt) AS FLOAT)/1000/60, 0.5) as p50_min,  -- needs extension
  COUNT(*) as cnt
FROM sessions
WHERE startedAt > :since AND agent = :agent
GROUP BY agent, type;

-- M2: Fork count per heartbeat (target: 1-2 forks per heartbeat)
SELECT s.sessionId, s.agent,
  COUNT(c.sessionId) as forks_spawned,
  CAST((s.endedAt - s.startedAt) AS FLOAT)/1000/60 as hb_min
FROM sessions s
LEFT JOIN sessions c ON c.parentSessionId = s.sessionId
WHERE s.task LIKE '%[heartbeat]%'
  AND s.startedAt > :since
GROUP BY s.sessionId;

-- M3: Fork success rate
SELECT parent.agent,
  COUNT(*) as total_forks,
  SUM(CASE WHEN c.status = 'done' THEN 1 ELSE 0 END) as done,
  SUM(CASE WHEN c.status = 'error' THEN 1 ELSE 0 END) as errors,
  AVG(CAST((c.endedAt - c.startedAt) AS FLOAT)/1000/60) as avg_fork_min
FROM sessions c
JOIN sessions parent ON c.parentSessionId = parent.sessionId
WHERE c.startedAt > :since
GROUP BY parent.agent;

-- M4: Turn limit hit rate (target: <5%, currently ~15%)
SELECT agent,
  COUNT(*) as total,
  SUM(CASE WHEN error LIKE '%Turn limit%' THEN 1 ELSE 0 END) as turn_limit_hits,
  ROUND(SUM(CASE WHEN error LIKE '%Turn limit%' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as hit_pct
FROM sessions
WHERE startedAt > :since AND (task LIKE '%[heartbeat]%' OR task LIKE '%[cron:%')
GROUP BY agent;
```

### 2.2 Agent-Level Metrics

```sql
-- M5: Useful output per day (tasks completed, not just sessions finished)
SELECT agent,
  date(startedAt/1000, 'unixepoch') as day,
  SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed,
  SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed,
  COUNT(*) as total
FROM sessions
WHERE startedAt > :since
GROUP BY agent, day;

-- M6: Work-to-overhead ratio (productive calls / total calls)
SELECT e.agent,
  date(s.startedAt/1000, 'unixepoch') as day,
  SUM(e.productiveCalls) as productive,
  SUM(e.wastedCalls) as wasted,
  ROUND(SUM(e.productiveCalls) * 100.0 / MAX(SUM(e.productiveCalls) + SUM(e.wastedCalls), 1), 1) as productive_pct
FROM evaluations e
JOIN sessions s ON e.sessionId = s.sessionId
WHERE s.startedAt > :since
GROUP BY e.agent, day;

-- M7: Cost per completed session
SELECT e.agent,
  CASE WHEN (s.task LIKE '%[heartbeat]%' OR s.task LIKE '%[cron:%') THEN 'cron' ELSE 'task' END as type,
  AVG(json_extract(e.usage, '$.cost')) as avg_cost,
  SUM(json_extract(e.usage, '$.cost')) as total_cost,
  COUNT(*) as sessions
FROM evaluations e
JOIN sessions s ON e.sessionId = s.sessionId
WHERE s.startedAt > :since AND s.status = 'done'
GROUP BY e.agent, type;
```

### 2.3 System-Level Metrics

```sql
-- M8: Total daily cost
SELECT date(s.startedAt/1000, 'unixepoch') as day,
  SUM(json_extract(e.usage, '$.cost')) as total_cost,
  SUM(json_extract(e.usage, '$.turns')) as total_turns,
  COUNT(*) as sessions
FROM evaluations e
JOIN sessions s ON e.sessionId = s.sessionId
WHERE s.startedAt > :since
GROUP BY day;

-- M9: Concurrent session peak
-- (Requires event-level data; approximate from sessions table)
SELECT 
  strftime('%H', startedAt/1000, 'unixepoch') as hour,
  MAX(concurrent) as peak_concurrent
FROM (
  SELECT s1.startedAt,
    (SELECT COUNT(*) FROM sessions s2 
     WHERE s2.startedAt <= s1.startedAt 
     AND (s2.endedAt IS NULL OR s2.endedAt >= s1.startedAt)
     AND s2.startedAt > :since) as concurrent
  FROM sessions s1
  WHERE s1.startedAt > :since
)
GROUP BY hour;
```

---

## 3. Heartbeat Interval Recommendation

### Analysis

Current state: 60-min intervals, sessions avg 7-17 min. Actual gap is ~77-88 min because session duration + scheduler jitter.

**If heartbeats become 2-5 min dispatchers:**
- Session overhead drops from ~10 min to ~3 min
- More time budget available for interval changes

### Recommendation: Keep 60-min intervals, measure first

**Rationale:**
1. **No observation gap.** Forked sessions run between heartbeats. The heartbeat checks on them next cycle. 60 min is adequate for observation cadence.
2. **Cost control.** Even at 3 min, a dispatcher heartbeat costs ~$0.30 (context loading + LLM reasoning). More frequent = more overhead. At 30 min intervals, dispatcher-only cost doubles.
3. **Diminishing returns.** Work happens in forks which run immediately. Faster heartbeats don't make forks start faster — they start at fork time.
4. **Proof first.** Before changing intervals, prove the pattern works at 60 min. If forks consistently complete between heartbeats, the interval is fine. If they need mid-flight guidance, that's an argument for a different mechanism (peek/nudge), not shorter intervals.

**Future consideration:** If data shows agents spend >50% of dispatcher time checking on stale state (no new forks to launch), reduce to 90-120 min intervals. If agents often have urgent unfinished forks needing attention, add a targeted "fork-watcher" cron (not a full heartbeat).

---

## 4. Concurrency Limits

### Constraints

1. **API rate limits.** All agents share API keys. Current peak: ~3 concurrent sessions. Each fork adds 1 concurrent session for 5-20 min. Risk: if 4 agents each fork 2 sessions = 8 concurrent + 4 parent = 12 total. This would likely hit rate limits.

2. **Context quality.** An agent managing forked sessions must hold context about each fork's task, current state, and expected output. At >2 forks, the dispatcher heartbeat itself becomes complex and expensive.

3. **Token cost.** Each fork costs $1-3 avg (based on current session costs). 2 forks/heartbeat × 24 heartbeats/day = 48 fork sessions/day = $48-144/agent/day. Current optimizer cost is ~$16-71/day.

4. **Work availability.** Most agents don't have 2+ independent tasks per heartbeat. The heartbeat reads a TODO, checks state, and acts. If there's only 1 actionable item, forking 2 sessions wastes the second.

### Recommendation: N=1 fork per heartbeat, hard cap N=2

**Rules:**
- **Default:** Each heartbeat may fork at most 1 session for focused work
- **Exception:** If heartbeat identifies 2 clearly independent tasks (e.g., one read-only research + one write), allow N=2
- **Hard limit:** Never >2 concurrent forks per agent. If previous forks are still running, observe them instead of launching new ones
- **Self-fork prohibited:** An agent shouldn't fork itself (coach→coach already happens for workflows — different mechanism)

**Enforcement:** Check before fork:
```sql
SELECT COUNT(*) as running_forks
FROM sessions
WHERE parentSessionId IN (
  SELECT sessionId FROM sessions WHERE agent = :agent AND status = 'running'
)
AND status = 'running';
-- If running_forks >= 2, skip fork
```

**Expansion criteria:** After 2 weeks of data, if:
- Fork success rate > 90%
- No API rate limit errors correlated with fork bursts
- Agents demonstrate 2+ independent tasks regularly
→ Then consider raising to N=3.

---

## 5. DB Queries for Fork Management

Agents need these queries during dispatcher heartbeats:

### Q1: My running forks
```sql
-- "What did I launch that's still going?"
SELECT c.sessionId, c.agent as fork_agent, c.status, c.opCount,
  CAST((strftime('%s','now')*1000 - c.startedAt) AS FLOAT)/1000/60 as running_min,
  substr(c.task, 1, 100) as task_preview
FROM sessions c
WHERE c.parentSessionId IN (
  SELECT sessionId FROM sessions 
  WHERE agent = :my_agent AND status = 'running'
)
AND c.status = 'running'
ORDER BY c.startedAt DESC;
```

### Q2: My recently completed forks
```sql
-- "What finished since my last heartbeat?"
SELECT c.sessionId, c.agent as fork_agent, c.status, c.opCount,
  CAST((c.endedAt - c.startedAt) AS FLOAT)/1000/60 as duration_min,
  c.outcome,
  substr(c.task, 1, 100) as task_preview
FROM sessions c
JOIN sessions p ON c.parentSessionId = p.sessionId
WHERE p.agent = :my_agent
  AND c.endedAt > :last_heartbeat_ts
ORDER BY c.endedAt DESC;
```

### Q3: Fork health check
```sql
-- "Is my fork stuck?"
SELECT c.sessionId, c.opCount,
  CAST((strftime('%s','now')*1000 - c.startedAt) AS FLOAT)/1000/60 as running_min,
  -- Check if ops are advancing
  (SELECT MAX(d.step) FROM session_digests d WHERE d.sessionId = c.sessionId) as latest_digest_step
FROM sessions c
WHERE c.parentSessionId IN (
  SELECT sessionId FROM sessions WHERE agent = :my_agent
)
AND c.status = 'running'
AND (strftime('%s','now')*1000 - c.startedAt) > 900000; -- >15 min
```

### Q4: My fork history (last 24h)
```sql
-- "How are my forks performing overall?"
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN c.status = 'done' THEN 1 ELSE 0 END) as done,
  SUM(CASE WHEN c.status = 'error' THEN 1 ELSE 0 END) as errors,
  AVG(c.opCount) as avg_ops,
  AVG(CAST((c.endedAt - c.startedAt) AS FLOAT)/1000/60) as avg_min,
  SUM(json_extract(e.usage, '$.cost')) as total_cost
FROM sessions c
JOIN sessions p ON c.parentSessionId = p.sessionId
LEFT JOIN evaluations e ON e.sessionId = c.sessionId
WHERE p.agent = :my_agent
  AND c.startedAt > (strftime('%s','now')*1000 - 86400000);
```

### Q5: Concurrency guard
```sql
-- "Can I fork another session?"
SELECT COUNT(*) as active_forks
FROM sessions c
WHERE c.parentSessionId IN (
  SELECT sessionId FROM sessions WHERE agent = :my_agent
)
AND c.status = 'running';
-- Proceed only if active_forks < 2
```

---

## 6. 48-Hour Experiment Design

### 6.1 Agent Selection: **Optimizer**

**Justification:**
1. **Highest turn-limit error rate** (12.5%, 18 errors in 7 days) — most to gain from offloading work to forks
2. **Heartbeat turns near-max** (38.3 avg turns vs 40 limit) — consistently runs out of room
3. **Clear task decomposition.** Optimizer heartbeat has 3 distinct phases: (a) read state, (b) pick highest-impact item, (c) implement fix. Phase (c) is fork-able.
4. **Self-contained.** Optimizer rarely needs coordination with other agents during implementation — ideal for independent forks
5. **Good baseline data.** 125 cron sessions, 142 evaluations in 7 days — statistically meaningful comparison

**Why not Bob?** Bob has lower error rate (9.9%) and his task sessions are already cheaper ($0.68 avg). Less headroom for improvement. Also Bob's work often involves writing designs that are reviewed by others — harder to decompose.

### 6.2 Experiment Structure

**Phase A: Baseline (24h, no changes)**
- Period: 2026-04-07 00:00 UTC → 2026-04-08 00:00 UTC (Monday)
- No intervention. Collect metrics under current heartbeat.md
- Expected: ~24 heartbeat sessions, ~$56 cost, ~4-6 turn-limit errors

**Phase B: Dispatcher pattern (24h)**  
- Period: 2026-04-08 00:00 UTC → 2026-04-09 00:00 UTC (Tuesday)
- Modified heartbeat.md with dispatcher instructions

### 6.3 Dispatcher Heartbeat Design

Replace optimizer's heartbeat behavior with:

```markdown
## Dispatcher Mode (Experiment)

1. **Read state** (turns 1-5): Check TODO, journal, recent digests. ~2 min.
2. **Check forks** (turns 6-8): Query running/completed forks from last cycle.
3. **Decide** (turns 9-10):
   - If a fork completed: review output, update TODO, checkpoint findings.
   - If a fork is running: peek, decide if it needs intervention.
   - If no fork running: identify top priority item, fork a session for it.
4. **Finish** (turn 11-12): Write journal entry, call finish().

**Rules:**
- Do NOT start implementing fixes directly. Fork instead.
- Max 1 fork per heartbeat. Max 2 concurrent.
- If no actionable work, finish early. Don't fill time.
- Target: <15 turns, <5 min.
```

### 6.4 Success Metrics (with thresholds)

| Metric | Baseline Target | Dispatch Target | Measure |
|--------|----------------|-----------------|---------|
| **Heartbeat duration** | ~8 min | <5 min | M1 |
| **Heartbeat turns** | ~38 | <15 | Eval turns |
| **Turn limit errors** | 4-6/day | 0/day | M4 |
| **Heartbeat cost** | ~$2.33 | <$0.80 | M7 |
| **Total work completed** | ~12 done/day | ≥12 done/day | M5 |
| **Total daily cost** | ~$56 | ≤$56 | M8 |
| **Fork success rate** | N/A | >85% | M3 |

**Primary success criterion:** Total daily cost ≤ baseline AND turn limit errors = 0 AND total work completed ≥ baseline.

**Secondary criterion:** Heartbeat avg < 5 min AND fork success rate > 85%.

### 6.5 Rollback Criteria (abort immediately if)

1. **Cost blowup:** Daily cost exceeds 1.5× baseline ($84) by hour 12 → revert
2. **Fork cascade:** >3 concurrent sessions running for same agent → revert
3. **Work collapse:** <50% of baseline completed sessions by hour 12 → revert  
4. **API rate limits:** >5 rate limit errors in 1 hour correlated with fork activity → revert
5. **Agent confusion:** Fork outputs are incoherent or duplicate work (manual check at hour 6 and 12)

### 6.6 Rollback Procedure

1. Restore original `agents/optimizer/heartbeat.md` from git
2. Add `ABORTED` entry to optimizer journal with reason
3. No cron config changes needed (interval stays 60 min)

---

## 7. Dashboard Queries for Monitoring

Run these during the experiment (e.g., every 6 hours):

### D1: Experiment overview
```sql
SELECT 
  date(s.startedAt/1000, 'unixepoch') as day,
  strftime('%H', s.startedAt/1000, 'unixepoch') as hour,
  COUNT(*) as sessions,
  SUM(CASE WHEN s.status = 'done' THEN 1 ELSE 0 END) as done,
  SUM(CASE WHEN s.status = 'error' THEN 1 ELSE 0 END) as errors,
  SUM(CASE WHEN s.error LIKE '%Turn limit%' THEN 1 ELSE 0 END) as turn_limit,
  AVG(s.opCount) as avg_ops,
  AVG(CAST((s.endedAt - s.startedAt) AS FLOAT)/1000/60) as avg_min,
  SUM(json_extract(e.usage, '$.cost')) as total_cost
FROM sessions s
LEFT JOIN evaluations e ON e.sessionId = s.sessionId
WHERE s.agent = 'optimizer'
  AND s.startedAt > :experiment_start
GROUP BY day, hour ORDER BY day, hour;
```

### D2: Fork tracking
```sql
SELECT 
  c.sessionId, c.status, c.opCount,
  CAST((COALESCE(c.endedAt, strftime('%s','now')*1000) - c.startedAt) AS FLOAT)/1000/60 as duration_min,
  json_extract(e.usage, '$.cost') as cost,
  substr(c.task, 1, 80) as task,
  substr(c.outcome, 1, 80) as outcome
FROM sessions c
JOIN sessions p ON c.parentSessionId = p.sessionId
WHERE p.agent = 'optimizer'
  AND c.startedAt > :experiment_start
ORDER BY c.startedAt DESC;
```

### D3: Cost comparison (baseline vs experiment)
```sql
SELECT 
  CASE 
    WHEN s.startedAt < :phase_b_start THEN 'A_baseline'
    ELSE 'B_dispatch'
  END as phase,
  COUNT(*) as sessions,
  SUM(CASE WHEN s.parentSessionId IS NULL THEN 1 ELSE 0 END) as root_sessions,
  SUM(CASE WHEN s.parentSessionId IS NOT NULL THEN 1 ELSE 0 END) as fork_sessions,
  SUM(json_extract(e.usage, '$.cost')) as total_cost,
  AVG(json_extract(e.usage, '$.cost')) as avg_cost,
  SUM(CASE WHEN s.status = 'done' THEN 1 ELSE 0 END) as completed,
  SUM(CASE WHEN s.error LIKE '%Turn limit%' THEN 1 ELSE 0 END) as turn_limits
FROM sessions s
LEFT JOIN evaluations e ON e.sessionId = s.sessionId
WHERE s.agent = 'optimizer'
  AND s.startedAt > :experiment_start
GROUP BY phase;
```

### D4: Concurrency check (run every hour during experiment)
```sql
SELECT 
  COUNT(*) as running_optimizer_sessions,
  GROUP_CONCAT(sessionId, ', ') as session_ids
FROM sessions 
WHERE agent = 'optimizer' AND status = 'running';
```

### D5: Quality comparison
```sql
SELECT
  CASE 
    WHEN s.startedAt < :phase_b_start THEN 'A_baseline'
    ELSE 'B_dispatch'
  END as phase,
  AVG(e.quality) as avg_quality,
  AVG(e.efficiency) as avg_efficiency,
  AVG(e.productiveCalls) as avg_productive,
  AVG(e.wastedCalls) as avg_wasted
FROM evaluations e
JOIN sessions s ON e.sessionId = s.sessionId
WHERE s.agent = 'optimizer'
  AND s.startedAt > :experiment_start
GROUP BY phase;
```

---

## 8. Risk Analysis

### High Risk: Fork-and-Forget
Dispatcher launches fork, then next heartbeat doesn't check on it. Fork fails silently, work is lost.
**Mitigation:** Dispatcher heartbeat MUST check Q2 (completed forks) before launching new ones. Add to heartbeat instructions.

### Medium Risk: Context Loss
Forked session doesn't have the dispatcher's full context (TODO state, previous findings).
**Mitigation:** Task description must be self-contained. Include specific file paths, expected output location, and success criteria in the fork task.

### Medium Risk: Double Work
Two heartbeats fork the same task because the first fork hasn't started yet.
**Mitigation:** Check Q5 (concurrency guard) and write a "fork launched" marker to journal before forking.

### Low Risk: Evaluator Confusion
Fork sessions may be harder to evaluate (shorter, more focused).
**Mitigation:** Existing evaluator handles all session types. Fork sessions should actually be easier to evaluate (clearer task, clearer outcome).

---

## 9. Implementation Checklist

Before experiment:
- [ ] Back up current `agents/optimizer/heartbeat.md` 
- [ ] Write dispatcher-mode heartbeat.md (Section 6.3)
- [ ] Create monitoring script that runs D1-D5 queries
- [ ] Verify Q5 concurrency guard works (test with manual fork)
- [ ] Run baseline metrics (D3) for the 24h before experiment

During Phase A (baseline):
- [ ] No changes. Let optimizer run normally for 24h.
- [ ] Snapshot D1, D3, D5 at end.

During Phase B (dispatch):
- [ ] Deploy new heartbeat.md
- [ ] Monitor D1, D4 every 6h
- [ ] Manual quality check at hour 6 and 12 (read fork outcomes)
- [ ] Check rollback criteria at hour 6, 12, 18

After experiment:
- [ ] Run full D1-D5 comparison
- [ ] Write results to `agents/optimizer/workspace/RESULT-dispatcher-experiment.md`
- [ ] Decision: adopt, iterate, or abandon
