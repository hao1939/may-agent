# Guide: Metrics in Your Heartbeat

**Purpose:** How to check your owned metrics during heartbeat observation step.  
**Audience:** All agents  
**Prerequisite:** Metric system Phase 1 is live (tables exist in `may.db`, snapshot handler running hourly)

---

## Quick Start: Add This to Your Observation Step

Add this query to your heartbeat's **existing** observation step (Step 1). Do NOT create a new step (KE-008).

```bash
export PATH=".state/.bun/bin:$PATH" && bun -e "
import{Database}from'bun:sqlite';
const db=new Database('.state/may.db',{readonly:true});
const rows=db.query(\`
  SELECT 
    m.id,
    m.priority as p,
    round(m.current,2) as cur,
    m.target as tgt,
    m.unit,
    CASE 
      WHEN m.type='health' AND m.threshold IS NOT NULL AND (m.current IS NULL OR m.current<m.threshold) THEN '🔴'
      WHEN m.type='health' THEN '✅'
      WHEN m.type='one-off' AND COALESCE(m.current,0)>=1 THEN '✅'
      WHEN m.type='one-off' THEN '⬜'
      WHEN m.current IS NULL THEN '—'
      WHEN m.target>0 AND m.current>=m.target THEN '✅'
      WHEN m.target>0 AND m.current/m.target<0.5 THEN '🔴'
      ELSE '🟡'
    END as st,
    (SELECT CASE WHEN s.value>m.current THEN '↓' WHEN s.value<m.current THEN '↑' ELSE '→' END
     FROM metric_snapshots s WHERE s.metric_id=m.id ORDER BY s.measured_at DESC LIMIT 1 OFFSET 1
    ) as trend
  FROM metrics m
  WHERE m.owner=? AND m.status IN ('active','blocked')
  ORDER BY m.priority, m.type
\`).all('YOUR_AGENT_NAME');
console.table(rows);
"
```

Replace `YOUR_AGENT_NAME` with your agent name (e.g., `coach`, `tech-lead`, `bob`, `scout`, `optimizer`, `may`).

**Performance:** <1ms per query. Safe to run every heartbeat.

---

## Reading the Output

```
┌───┬─────────────────┬────┬──────┬─────┬───────┬────┬───────┐
│   │ id              │ p  │ cur  │ tgt │ unit  │ st │ trend │
├───┼─────────────────┼────┼──────┼─────┼───────┼────┼───────┤
│ 0 │ quality.coder   │ P1 │ 0.56 │ 0.9 │ score │ 🟡 │ ↑     │
│ 1 │ gym.pass-rate   │ P1 │ 54.2 │ 70  │ %     │ 🟡 │ →     │
│ 2 │ health.tsc-clean│ P1 │ 0    │ 0   │ count │ ✅ │ →     │
└───┴─────────────────┴────┴──────┴─────┴───────┴────┴───────┘
```

### Columns

| Column | Meaning |
|--------|---------|
| `id` | Metric identifier |
| `p` | Priority: P0 (urgent), P1 (important), P2 (nice-to-have) |
| `cur` | Current measured value |
| `tgt` | Target value |
| `unit` | Unit of measurement (`%`, `score`, `count`, or null for one-offs) |
| `st` | Status indicator (see below) |
| `trend` | Direction since last snapshot: `↑` improving, `↓` declining, `→` flat, `null` = first snapshot |

### Status Indicators

| Icon | Meaning | Action |
|------|---------|--------|
| 🔴 | **Red** — Health metric below threshold, OR continuous metric <50% of target | Investigate. Consider forking a fix session. |
| 🟡 | **Yellow** — Continuous metric progressing but not at target yet | Normal. Keep pushing. |
| ✅ | **Green** — Health metric above threshold, or metric at/above target | No action needed. |
| ⬜ | **Not started** — One-off metric not yet completed | Plan when to tackle it. |
| — | **No data** — No measurement recorded yet | If `source=manual`, you need to record a measurement. |

---

## What To Do With Your Metrics

### ⚠️ Goodhart's Law Warning
> **Metrics are signals, not targets.** They inform your judgment — they don't replace it.
> If a metric says "conclude more hypotheses" but you just found an interesting cross-cutting pattern, **follow the pattern**. The metric will catch up.

### Decision Flow

1. **Read your metrics** — what's red? what's progressing?
2. **Is anything 🔴?** → Investigate root cause. Fork a fix if needed.
3. **Pick work based on priority band** — P0 > P1 > P2. Within a band, use judgment.
4. **Don't chase numbers** — If you're making good progress on a P1 metric and a P2 is red, the P1 work is probably still more important.
5. **Override when context says so** — A P0 dispatch from May trumps metric priorities. A breakthrough insight trumps routine metric work.

### By Metric Type

| Type | Your Pattern |
|------|-------------|
| **Health** (🔴/✅) | Only act when red. Fork a fix, then move on. |
| **Continuous** (🟡) | Fork persistent-task iterations to push the number. Check trend — if flat after 3+ snapshots, change approach. |
| **One-off** (⬜) | Plan and execute. Mark done when complete. |
| **Manual** (—) | You own the measurement. Record when you have new data (see below). |

---

## Recording Manual Measurements

If you own a `source=manual` metric, record a measurement when you have new data:

```bash
export PATH=".state/.bun/bin:$PATH" && bun -e "
import{Database}from'bun:sqlite';
const db=new Database('.state/may.db');
const now=Date.now();
db.run('INSERT INTO metric_snapshots (metric_id,value,sample_size,measured_at,measured_by,note) VALUES (?,?,?,?,?,?)',
  ['METRIC_ID', VALUE, SAMPLE_SIZE, now, 'manual:YOUR_AGENT', 'optional note']);
db.run('UPDATE metrics SET current=?,updated_at=? WHERE id=?',
  [VALUE, now, 'METRIC_ID']);
console.log('Recorded METRIC_ID =', VALUE);
"
```

Replace:
- `METRIC_ID` — e.g. `skill.effectiveness`, `infra.persistent-task-adoption`
- `VALUE` — the measured number
- `SAMPLE_SIZE` — how many data points (null if N/A)
- `YOUR_AGENT` — your agent name

**Intervention notes:** When you deploy a change that should affect a metric, add a note prefixed with `INTERVENTION:`:
```
'INTERVENTION: promoted skill verify-after-edit to coder at 14:30'
```

---

## For Research Agents: Logging Output to research_log

**Bob and Scout** — after producing output (deep dive, hypothesis, experiment, knowledge entry), INSERT a row so throughput metrics can auto-measure:

```bash
export PATH=".state/.bun/bin:$PATH" && bun -e "
import{Database}from'bun:sqlite';
const db=new Database('.state/may.db');
db.run('INSERT INTO research_log (type,ref,agent,rating,created_at) VALUES (?,?,?,?,?)',
  ['TYPE', 'REF', 'AGENT', null, Date.now()]);
console.log('Logged TYPE REF');
"
```

### Valid `type` values

| type | Who | Example ref |
|------|-----|------------|
| `deep-dive` | Scout | `DD#690` |
| `hypothesis` | Scout | `H-097` |
| `experiment` | Bob | `EXP-148` |
| `triage` | Scout | `TR-042` |
| `knowledge-entry` | Scout/Bob | `KE-187` |

### What this feeds
- `research.dd-rate` — deep dives per week (Scout)
- `research.hypothesis-generation` — hypotheses proposed in 30 days (Scout)
- Future: `research.hypothesis-pickup-rate` (cross-agent)

**Add this INSERT to your exit step** — one line, <1ms, no friction.

---

## Checking Active Alerts

To see if any of your metrics have unresolved alerts:

```bash
export PATH=".state/.bun/bin:$PATH" && bun -e "
import{Database}from'bun:sqlite';
const db=new Database('.state/may.db',{readonly:true});
const alerts=db.query(\`
  SELECT a.metric_id, a.severity, a.message, a.created_at
  FROM metric_alerts a
  JOIN metrics m ON m.id=a.metric_id
  WHERE m.owner=? AND a.resolved_at IS NULL
  ORDER BY a.created_at DESC
\`).all('YOUR_AGENT_NAME');
if(alerts.length===0) console.log('No active alerts.');
else console.table(alerts);
"
```

---

## FAQ

**Q: How often are metrics updated?**  
A: Auto/command metrics: every 1 hour (cron handler). Manual metrics: whenever you record them.

**Q: What if a query returns null for `cur`?**  
A: The metric hasn't been measured yet. If it's auto/command, wait for the next cron cycle. If manual, record a baseline.

**Q: Should I add this query to every heartbeat?**  
A: Yes — it's <1ms. But DON'T let metric reading bloat your heartbeat. Read → decide → fork work. The metrics inform your decision step, not your action step.

**Q: Can I propose a new metric?**  
A: Yes. Send a message to May: `agents.message('may', 'Propose metric: <id>, <name>, <type>, <owner>, <target>, <reason>')`. P2 metrics are approved by May, P0/P1 by Hao.

**Q: Where's the full design?**  
A: `agents/shared/may-agent-docs/design/metrics-system.md`
