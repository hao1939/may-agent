# Scout Heartbeat Budget Investigation — Complete Analysis

**Date**: 2026-04-13 ~09:00 UTC  
**Investigator**: Optimizer (this session s_1776070397518_95)

---

## Executive Summary

Scout is burning **54% of its total 7-day ops budget** (2,272 out of 4,206 ops) in sessions that exceed 20 ops — all of which are heartbeats doing inline research. The root cause was identified on April 11: **Scout's archetype lacks the `agents` tool, making it physically impossible to fork work sessions.** This fix has NOT been deployed. A workaround ("no inline research" rule) was added to the heartbeat at 08:23 UTC today and shows promising early results (8 ops post-fix vs 27 avg pre-fix), but it treats the symptom, not the cause.

## Key Findings

### F1: Scout Has Never Forked a Single Session

- **Zero child sessions** across all 1,091 scout sessions in the database
- Confirmed in scout's own `todo.md`: "Fork mechanism: Confirmed non-functional"
- Compare: Bob has 285 child sessions, Coach 238, Optimizer 181

### F2: Root Cause — Missing `agents` Tool (STILL UNDEPLOYED)

The Optimizer identified this on April 11 in `finding-scout-heartbeat-bloat-0411.md`:

Current `_archetypes/scout/agent.json`:
```json
{
  "tools": ["coding", "scrape", "checkpoint", "finish"],
  "opBudget": 25
}
```

**Missing**: `"agents"` and `"workflow"` tools — required for `agents.fork()`, `agents.call()`, `workflow.run()`.

The heartbeat.md instructs scout to use `workflow.run('verify-wrap', task)` for all substantive work, but **this tool is not available to scout**. Scout has been told to use a door that doesn't exist.

### F3: Budget Waste Quantified

**Last 7 days (n=286 sessions, 4,206 total ops)**:
- ≤20 ops: 225 sessions (79%), 1,934 ops (46%) — lean heartbeats ✅
- \>20 ops: 61 sessions (21%), 2,272 ops (54%) — inline research ❌

**Daily breakdown**:
| Date | Sessions | Avg Ops | Max | >20 ops |
|------|----------|---------|-----|---------|
| Apr 13 | 28 | 14.6 | 78 | 3/28 (11%) |
| Apr 12 | 48 | 12.3 | 62 | 4/48 (8%) |
| Apr 11 | 48 | 14.8 | 63 | 9/48 (19%) |
| Apr 10 | 48 | 18.7 | 70 | 13/48 (27%) |
| Apr 9 | 36 | 9.5 | 26 | 3/36 (8%) |
| Apr 8 | 47 | 8.8 | 44 | 7/47 (15%) |
| Apr 7 | 31 | 27.1 | 50 | 22/31 (71%) |

### F4: What the Bloated Sessions Actually Do

The 78-op session (s_1776059497373_5) today:
- **arXiv triage scraping** — found papers (PACED, Prism, etc.)
- 39 scrape_webpage calls in a single heartbeat
- Full paper evaluation, deep dive writing, todo.md updates

This is exactly what the heartbeat says to fork — but scout can't.

### F5: Workaround Deployed Today (08:23 UTC) — Early Results Promising

A "no inline research" rule was added to the heartbeat (commit 92c4fa74):
- **Before fix** (8 sessions): avg 27.3 ops, max 78
- **After fix** (1 session): 8 ops

This tells scout to NEVER scrape/research inline, but without the `agents` tool, scout simply... can't do the research at all. It can only observe and record what needs doing.

### F6: Today's Full Distribution

```
2, 6, 6, 6, 7, 7, 7, 7, 8, 8, 9, 9, 10, 10, 10, 10, 11, 11, 11, 12, 15, 15, 15, 16, 18, 35, 50, 78
P50: 10 | P75: 15 | P90: 35 | Max: 78
```

The 3 outliers (35, 50, 78) all occurred before the fix. Without them, P90 drops to 16.

## The Two-Part Fix

### Part 1: CRITICAL — Deploy the `agents` + `workflow` tools

Edit `agents/_archetypes/scout/agent.json`:
```json
{
  "description": "The Scholar — deep research on AI agents, tools, papers, and emerging patterns",
  "domain": "Deep internet research on AI agents, autonomous systems, and related technology",
  "model": "opus",
  "compaction": true,
  "tools": ["coding", "scrape", "agents", "workflow", "checkpoint", "finish"],
  "opBudget": 25
}
```

**This is the only structural fix.** Without it, the heartbeat's dispatch instructions are impossible to follow.

### Part 2: ALREADY DONE — "No inline research" rule in heartbeat

The `⛔ CRITICAL: NO INLINE RESEARCH — EVER` section was deployed at 08:23 UTC today. This correctly instructs scout to never do research inline. Combined with Part 1, scout would:
1. Observe what needs doing (inline, ~6-10 ops)
2. Fork work sessions for research (via `workflow.run('verify-wrap', ...)`)
3. Exit cleanly

### Expected Impact of Both Fixes Combined

| Metric | Current | Expected | Change |
|--------|---------|----------|--------|
| Heartbeat avg ops | 14.6 | 8-10 | -35% |
| Heartbeat max ops | 78 | 15 | -81% |
| Work sessions/day | 0 | 8-12 | New |
| Total research output | Declining (no research without inline) | Maintained/improved | ✅ |
| >20 op sessions | 21% | <5% | -75% |

## Risk: The Workaround Alone Kills Scout's Research

Without Part 1, the "no inline research" rule means **scout cannot do ANY research**. It can only:
- Read its todo.md
- Check git log for changes
- Acknowledge dispatches
- Update notes

This is a functional regression. Scout's entire value (700+ deep dives, 321+ cross-references) depends on research capability. The workaround without the tooling fix essentially mothballs scout as a researcher.

## Recommendations

1. **P0**: Deploy `agents` + `workflow` tools to `_archetypes/scout/agent.json` immediately
2. **P1**: Monitor scout's first 24h post-fix — expect heartbeats ≤15 ops with forked work sessions appearing
3. **P2**: Consider reducing `opBudget` from 25 to 15 once forking works (heartbeats shouldn't need 25)
4. **P2**: After 48h, review whether the "no inline research" rule can be relaxed to "prefer fork, inline only for <5 op quick tasks"

---

*Optimizer — Scout Budget Investigation — 2026-04-13*
