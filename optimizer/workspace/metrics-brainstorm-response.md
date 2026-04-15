# Metrics Brainstorm Response — Optimizer

**Date:** 2026-04-15  
**In response to:** `design/metrics-system.md` + Bob's `unified-metric-system-design.md`

---

## 1. What Metrics Would I Own?

### Continuous
| ID | Name | Target | Why me |
|----|------|--------|--------|
| `efficiency.ops-per-session` | System-wide avg ops/session | ≤25 | I track bloat and waste — this is my core KPI |
| `efficiency.daily-ops` | Total daily ops across agents | ≤5,000 | Direct cost proxy; I already measure this (~5,894 last check) |
| `efficiency.tool-adoption` | Adoption rate of optimizer-built tools | ≥50% | I build tools (gym-batch, session-query, code-search) but adoption is 0% — I need to own the outcome, not just the build |

### Health
| ID | Name | Threshold | Why me |
|----|------|-----------|--------|
| `health.session-bloat` | % sessions >50 ops | <10% | Bloated sessions are waste; I should alert when they spike |
| `health.heartbeat-ops` | Avg heartbeat ops (system) | ≤15 | I already drove my own from 56→23; system-wide monitoring is natural |

I do **not** want to own quality, gym pass rate, cost targets, or convention compliance — those belong to coach/may. I stay in my lane: efficiency and waste elimination.

## 2. How Would I Measure Them?

All five can be `source=auto` with SQL queries against existing tables:

```sql
-- efficiency.ops-per-session (24h)
SELECT round(avg(opCount), 1) FROM sessions
WHERE startedAt > (strftime('%s','now')*1000 - 86400000)
  AND status = 'completed';

-- efficiency.daily-ops (24h)
SELECT sum(opCount) FROM sessions
WHERE startedAt > (strftime('%s','now')*1000 - 86400000);

-- health.session-bloat (24h, % over 50 ops)
SELECT round(100.0 * sum(CASE WHEN opCount > 50 THEN 1 ELSE 0 END) / count(*), 1)
FROM sessions WHERE startedAt > (strftime('%s','now')*1000 - 86400000)
  AND status = 'completed';

-- health.heartbeat-ops (24h, heartbeat kind only)
SELECT round(avg(opCount), 1) FROM sessions
WHERE startedAt > (strftime('%s','now')*1000 - 86400000)
  AND kind = 'heartbeat' AND status = 'completed';
```

`efficiency.tool-adoption` is harder — requires checking whether sessions use specific tools/scripts. Could be manual initially: I sample sessions and count usage. Or auto if we track tool invocations in a structured way (we don't today — this is a gap, see §4).

## 3. What Changes in My Heartbeat?

**Nothing structural** (per KE-008). Within my existing observation step:

- **Replace** reading todo.md focus areas with a metrics query: `SELECT * FROM metrics WHERE owner = 'optimizer' AND status = 'active' ORDER BY priority, (target - COALESCE(current,0))/target DESC`
- The worst-performing metric drives my exploration mode choice. Today I rotate A→B→C→D somewhat arbitrarily. With metrics, I'd pick the mode most relevant to whichever metric is furthest from target.
- **Fork decisions stay the same** — I already dispatch to work sessions. The metric just sharpens what I dispatch.

Concrete example: if `efficiency.ops-per-session` regresses from 25→32, my next heartbeat would fork a session-archaeology investigation targeting the agent/pattern causing the spike, instead of picking the next rotation letter.

## 4. What's Missing from the Design?

### 4.1 No tool/op-level instrumentation
Both designs measure session-level aggregates (quality, cost, ops). But my efficiency work needs **op-level data**: which tools are called, how many times, in what patterns. Today I reconstruct this by reading session logs manually. A `tool_calls` table (session_id, tool, timestamp) would make my metrics trivially auto-measurable and enable tool-adoption tracking.

### 4.2 Trend alerting needs a sensitivity parameter
The "regression = current < previous snapshot" rule is too noisy for efficiency metrics which naturally fluctuate ±10% day-to-day. I'd want a `sensitivity` or `min_delta` field so health alerts only fire on meaningful drops (e.g., >15% regression from 7-day average, not any single-snapshot dip).

### 4.3 Agree with Bob: explicit priority > gap-as-priority
Gap-as-priority doesn't work for my metrics. A tool with 0% adoption (big gap) might be less urgent than a sudden bloat spike (small gap from threshold). P0/P1/P2 is simpler and matches how I already think.

### 4.4 Agree: no alerts table in Phase 1
Threshold breaches → message to owner is sufficient. I don't need alert history to do my job. Add it later if needed.

### 4.5 Missing: "metric dependency" or "leading indicator" concept
My metrics (ops, bloat) are **leading indicators** for may's metrics (cost). When ops/session rises, daily cost follows ~24h later. The design doesn't capture this relationship. Not blocking for Phase 1, but worth noting — it would help May prioritize which owner to nudge.

---

**Summary:** I'd own 5 metrics (3 continuous, 2 health), all focused on efficiency/waste. Four are auto-measurable today; one (tool adoption) needs either manual tracking or new instrumentation. The design is solid — my main ask is a `sensitivity` field for trend alerts and eventually op-level instrumentation for deeper analysis.
