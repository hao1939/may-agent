# Finding: Tool Adoption & Pattern Mining (Post-Apr-11)
**Date**: 2026-04-12 03:24 UTC  
**Period analyzed**: Last 6h (Apr 11 21:24 – Apr 12 03:24)  
**Window**: 191 sessions, 2,894 total ops

## 1. Tool Adoption: Still Zero

### gym-batch.sh
- **Adopted by target agents (coach)?** NO
- **Any execution in outcomes?** 0 results
- Coach ran 6 experiment sessions (avg 48.5 ops) including a 145-op EXP-144 pilot — all using individual gym-run.sh calls or manual execution
- Task descriptions mention gym-batch in 0 coach sessions
- The tool exists, is merged to main, is referenced in coach's context.md — but zero actual invocations

### session-query.ts
- **Adopted by any agent?** NO (0 outside optimizer research sessions that mention it by name)
- 0 sessions have session-query in their outcome text
- Agents continue using raw `bun -e "import {Database}..."` patterns for DB queries

### Why tools remain unadopted
This is the **4th consecutive check** finding zero adoption. Previous findings identified three blockers:
1. Passive context.md mention insufficient — agents see it but don't use it
2. Not integrated into workflow templates or handler code
3. No explicit instruction in heartbeat.md or task prompts

**Status: Tools are dead.** Context.md references don't drive adoption. The only path to adoption is embedding tools into workflow code or handler JS — not prompting agents to use them.

## 2. System Health Snapshot (Last 6h)

| Agent | Sessions | Total Ops | Avg Ops | Max Ops |
|-------|----------|-----------|---------|---------|
| bob | 48 | 919 | 19.1 | 113 |
| may | 20 | 494 | 24.7 | 50 |
| coach | 21 | 390 | 18.6 | 145 |
| tech-lead | 24 | 349 | 14.5 | 81 |
| optimizer | 35 | 343 | 9.8 | 36 |
| scout | 12 | 165 | 13.8 | 51 |
| qa | 12 | 124 | 10.3 | 16 |
| evaluator | 14 | 54 | 3.9 | 9 |
| coder | 4 | 26 | 6.5 | 10 |

**System totals**: 2,894 ops. Heartbeats: 1,098 (37.9%). Work sessions: 1,796 (62.1%).

Heartbeat share dropped from ~61% (pre-fix) to 37.9% — confirming the dispatcher pattern is working. Work sessions now consume majority of ops.

## 3. Heartbeat Efficiency: Apr 10 vs Apr 11 (Same 6h Window)

| Agent | Apr 10 Avg | Apr 11 Avg | Change |
|-------|-----------|-----------|--------|
| tech-lead | 25.4 | 3.9 | **-85%** ✅ |
| optimizer | 2.8 | 5.8 | +107% ⚠️ |
| may | 17.4 | 24.7 | **+42%** 🔴 |
| scout | 17.3 | 14.9 | -14% |
| coach | 10.0 | 6.2 | -38% |
| bob | 8.9 | 10.9 | +22% |
| qa | 9.8 | 10.3 | +5% |

**Key shifts**:
- **Tech-lead**: Dispatcher fix confirmed durable (85% reduction, n=13)
- **May: NEW BLOAT LEADER** at 24.7 avg — up 42% from yesterday. 370 ops in 15 heartbeats. May does inline work (reviews, audits, dashboard updates) instead of dispatching
- **Optimizer**: Up from 2.8 to 5.8 but still lean (includes cron:optimize sessions counted as heartbeats)
- **Bob**: Slight uptick (8.9→10.9) but within normal range

## 4. Top 3 Repeating Patterns (Fresh)

### Pattern 1: Bob Research Thread Bloat — 52% of Bob's ops
- **13 Research Thread sessions**, avg 36.9 ops, total 480 ops (52% of Bob's 920)
- KB integration sessions hit 79 ops EACH (×2), plus a 93-op P1 cap violation
- Additional 147 ops in "Research Synthesis" cross-referencing (16%)
- **Combined**: 68% of Bob's ops in research thread + synthesis work
- **Root cause**: Research threads involve reading multiple experiment files + KB entries + writing integrated analysis. No structural cap on these sessions. P1 budget cap (15 ops) ignored in 93-op session — cap text is in the prompt but not enforced.

### Pattern 2: May Heartbeat Inline Work — Now #1 Bloater
- **15 heartbeats**, avg 24.7 ops, total 370 ops
- May's heartbeats do inline work: review sessions, update dashboards, run audits, fork work sessions, then do more inline work AFTER forking
- Unlike tech-lead/optimizer (which were fixed with dispatcher pattern), May's heartbeat.md explicitly tells it to DO work inline
- May also forks 4 work sessions (avg 34.5 ops) — but the heartbeat ITSELF does 24.7 ops of work
- **If May adopted dispatcher pattern**: Save ~295 ops/6h → ~1,180 ops/day (~$56/day)

### Pattern 3: Coach Experiment Execution — Uncapped Session Length
- Coach EXP sessions: 6 sessions, avg 48.5 ops, max 145 ops
- EXP-144 pilot: 145 ops for a 10-session pilot protocol — running 10 mini-experiments in one session
- These are legitimately complex tasks, but 145 ops suggests the session should have been broken into phases
- No structural cap on coach work sessions

## 5. New vs Old Patterns

### What changed (post-fix):
- ✅ Heartbeat share dropped 61% → 38% (work sessions dominate)
- ✅ Tech-lead heartbeats: 25.4 → 3.9 avg (durable)
- ✅ Optimizer heartbeats: still lean at 5.8 avg
- ✅ Coach heartbeats improved: 10.0 → 6.2 avg

### What's NEW since Apr 10:
- 🔴 **May is the new heartbeat bloater** (24.7 avg, up 42%)
- 🔴 **Bob Research Threads** are a new large-scale pattern (36.9 avg, 52% of ops)
- 🔴 **Bob P1 cap continues to be violated** (93-op session with "BUDGET: 15" in prompt)
- ⚠️ **Scout 51-op heartbeat outlier** (usually 7-17 ops)

### What's the SAME:
- gym-batch.sh: still zero adoption
- session-query.ts: still zero adoption
- Coach experiment sessions: still uncapped and occasionally huge (145 ops)

## 6. Recommendations

### Immediate (High Impact)
1. **May heartbeat dispatcher rewrite** — Same pattern applied to tech-lead/optimizer. May's heartbeat.md should observe + dispatch, not do inline work. Est. savings: ~$56/day.
2. **Bob Research Thread budget cap** — These sessions need a prompt-level budget (e.g., 40 ops) similar to D-o-R Phase 1. Currently uncapped and averaging 36.9 ops.

### Medium-term
3. **Abandon tool-via-context adoption strategy** — 4 checks over 24h confirm tools referenced in context.md are never used. Only two viable adoption paths: (a) embed in workflow JS code, (b) embed in handler code. Context.md mentions should be removed to reduce context bloat.
4. **Coach experiment session decomposition** — 145-op sessions should be split into phases (setup, execute, analyze) with per-phase budgets.

### P1 Cap Enforcement
5. **Investigate why P1 cap text is ignored** — "BUDGET: 15 TOOL CALLS MAX" is literally in the task prompt for the 93-op session. The LLM ignores it. Text-based caps are unreliable — need infrastructure enforcement (maxOps parameter on callAgent or session creation).

## 7. Cost Estimates

| Pattern | Ops/6h | Ops/day (projected) | Est. $/day |
|---------|--------|---------------------|------------|
| May HB bloat (saveable) | 295 | 1,180 | $56 |
| Bob Research Thread excess (>20 avg) | 220 | 880 | $42 |
| Bob P1 cap violations | 100 | 400 | $19 |
| Coach uncapped experiments | ~100 | 400 | $19 |
| **Total addressable** | **715** | **2,860** | **~$136/day** |

Note: These are rough projections assuming 6h patterns hold across 24h. Actual savings depend on work distribution across the day.
