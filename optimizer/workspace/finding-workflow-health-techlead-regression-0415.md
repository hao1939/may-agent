# Finding: Workflow Health & Tech-Lead Heartbeat Regression — Apr 15

**Date**: 2026-04-15 16:00 UTC  
**Mode**: D (Workflow Health) + Tech-Lead Investigation  
**Prior baseline**: Workflow adoption 27.3% (Apr 12), TL heartbeat avg 3.5 ops (post-fix Apr 11-12)

---

## 1. Workflow Adoption — Oscillating, Not Growing

### Trend (Apr 9–15)
| Date   | WF Sessions | Total | Rate   |
|--------|-------------|-------|--------|
| Apr 9  | 60          | 575   | 10.4%  |
| Apr 10 | 45          | 528   | 8.5%   |
| Apr 11 | 87          | 581   | 15.0%  |
| Apr 12 | 157         | 576   | **27.3%** |
| Apr 13 | 34          | 506   | 6.7%   |
| Apr 14 | 80          | 604   | 13.2%  |
| Apr 15 | 79          | 372   | 21.2%  |

### Diagnosis: Sawtooth pattern, NOT sustained growth
- Apr 12's 27.3% peak was driven by bob (67.8%) and optimizer (66.1%)
- Apr 13 crashed to 6.7% — likely because high-WF agents had fewer sessions that day
- Apr 15 recovering to 21.2% but hasn't exceeded the Apr 12 high water mark
- **Adoption is agent-dependent, not systemic**. 7 agents still at 0-8% adoption.

### Today's breakdown (Apr 15):
| Agent      | WF  | Total | Rate   |
|------------|-----|-------|--------|
| coder      | 17  | 19    | 89.5%  |
| optimizer  | 20  | 44    | 45.5%  |
| bob        | 18  | 47    | 38.3%  |
| coach      | 10  | 39    | 25.6%  |
| tech-lead  | 10  | 55    | 18.2%  |
| scout      | 2   | 25    | 8.0%   |
| qa         | 2   | 23    | 8.7%   |
| may        | 0   | 30    | 0.0%   |
| evaluator  | 0   | 90    | 0.0%   |

### Key insight
Coder surged to **89.5%** (was 50% on Apr 12) — nearly all coder sessions now use workflows. Bob dropped from 67.8% → 38.3%. This confirms adoption is driven by **structural enforcement** (coder gets dispatched through workflows) not behavioral compliance. Agents that choose whether to use workflows fluctuate wildly.

### 72h aggregate: 204/1547 = **13.2%** — well below the Apr 12 peak

---

## 2. Tech-Lead 100+ Op Heartbeats — Recurring Regression

### The incidents
| Session | Ops | Time  | Status      | Children |
|---------|-----|-------|-------------|----------|
| s_..111_5  | 100 | 13:30 | done        | **0**    |
| s_..460_23 | 103 | 14:00 | interrupted | **0**    |

Both are heartbeat sessions (task: "[heartbeat] Read agents/tech-lead/heartbeat.md...").  
Both spawned **zero children** — all 100+ ops were executed inline.

The 100-op session completed successfully (status: done, quality: 1.0).  
The 103-op session was aborted (status: interrupted, error: "Request was aborted.").

### Is this a regression from the fix?

**Partially.** The Apr 11 heartbeat fix worked — post-fix averages were excellent:

| Window              | n  | Avg  | Max | Notes                    |
|---------------------|-----|------|-----|--------------------------|
| Apr 12 00-06        | 13  | 2.6  | 8   | ✅ Fix working perfectly  |
| Apr 12 06-12        | 13  | 5.6  | 10  | ✅ Excellent              |
| Apr 12 12-18        | 16  | 8.1  | 38  | ⚠️ One outlier           |
| Apr 13 06-12        | 17  | 9.5  | 50  | ⚠️ Creeping up           |
| Apr 14 00-06        | 17  | 18.2 | 182 | 🔴 Major outlier         |
| Apr 14 12-18        | 18  | 15.2 | 86  | 🔴 Another               |
| **Apr 15 12-18**    | 14  | **26.9** | **103** | 🔴 Two 100+ ops    |
| Apr 15 06-12        | 17  | 7.0  | 11  | ✅ Same day, fine window  |

### Pattern: Sporadic blowouts, not systemic regression
- Most windows remain well-controlled (avg 5-10 ops)
- But every ~12-24h, one heartbeat goes to 50-182 ops
- The fix works for ~80% of heartbeats but doesn't cap the worst cases
- **The 100-op session was rated quality=1.0** — the LLM did useful work, it just did WAY too much of it inline

### 7-day distribution (n=343 TL heartbeats):
- P25: 2 ops, Median: 5 ops, P75: 15 ops, P90: 35 ops, Max: 182 ops
- Only 3 sessions ≥100 ops (0.9%), 12 sessions ≥50 ops (3.5%)
- Average: 12.0 ops (inflated by long tail)

### Comparison to pre-fix:
- Pre-fix (Apr 6-7): Multiple 100-200 op heartbeats per day
- Post-fix (Apr 12): Near-zero >50 op sessions
- Current (Apr 14-15): 1-2 blowouts per day — **improved but not capped**

### Root cause hypothesis
The heartbeat prompt says to dispatch work, but doesn't enforce a hard op budget. When the LLM finds substantial work (e.g., stale branches to review, metrics to validate), it sometimes inlines the entire task rather than forking. The 100-op session that completed "successfully" proves this — it did real work, just in the wrong process.

---

## 3. Recommendations

### Workflow adoption
- **Stop trying to increase adoption through text/context** — confirmed dead (KE-026, tool adoption patterns finding)
- The only path to higher adoption: **more workflows for more task types**
- Current coder at 89.5% proves structural enforcement works
- May (0%) and evaluator (0%) need workflow-dispatched tasks to ever adopt

### Tech-lead heartbeat
- **Do NOT restructure heartbeat.md** (KE-008)
- Consider infrastructure-level op budget: heartbeats hard-capped at 30 ops
- Alternative: Add a "fork if >15 ops remaining" prompt line within existing structure
- The blowouts are infrequent (3.5% of heartbeats) but expensive (~200+ ops/day wasted when they occur)

---

## Summary
- **Workflow adoption: Oscillating 6.7-27.3%**, not sustaining growth. Agent-dependent, not systemic. Coder at 89.5% (structural), bob dropped to 38.3% (behavioral).
- **TL heartbeat: Fix holds for ~96% of sessions** but sporadic 100+ op blowouts persist (~1-2/day). Both Apr 15 incidents were zero-fork inline work sessions. Infrastructure op cap is the reliable fix.
