# Finding: Scout Heartbeat Bloat — Dispatcher Without Dispatch

**Date**: 2026-04-11
**Author**: Optimizer (Session Archaeology, Mode A)
**Status**: ROOT CAUSE IDENTIFIED — actionable fix available

---

## Executive Summary

Scout's heartbeat averages **22.4 turns/session** with 28% of sessions exceeding 30 turns (bloated). The worst sessions hit **85-95 turns**. Despite having a well-written dispatcher heartbeat.md that instructs "fork substantive work," scout has **never forked a single work session** — 0 out of 359 sessions are forked.

**Root cause**: Scout's agent.json lacks the `"agents"` tool. It physically cannot call `agents.fork()`. The heartbeat tells it to fork, but the toolset makes that impossible. Scout compensates by doing all research inline, inflating heartbeats.

**Estimated impact of fix**: Adding `"agents"` tool → heartbeats drop from avg 22.4 to ~10 turns. The 28% bloated sessions (avg 46.4 turns) become 10-turn dispatches + separate work sessions. Heartbeat turn overhead reduced by **~55%**.

---

## Data

### Scout Session Statistics (n=359, all heartbeats)

| Metric | Value |
|--------|-------|
| Total sessions | 359 |
| Work sessions forked | **0** |
| Average turns | 22.4 |
| Median turns | 15.0 |
| Max turns | 95 |
| Std dev | 18.2 |

### Distribution by Turn Range

| Range | Count | % | Description |
|-------|-------|---|-------------|
| 0-10 turns | 115 | 32% | Lean — nothing to do or quick check |
| 11-15 turns | 69 | 19% | Normal — observe + small update |
| 16-20 turns | 33 | 9% | Moderate — some inline work |
| 21-30 turns | 43 | 12% | Heavy — should be forked |
| 31-50 turns | 69 | 19% | Bloated — full research inline |
| 51-100 turns | 30 | 8% | Severely bloated — deep dive inline |

### What Bloated Sessions Do

Analysis of 99 sessions with >30 turns reveals a consistent pattern:

1. **Inline research**: arXiv scraping, Semantic Scholar searches, paper evaluation
2. **Inline writing**: Deep dives (DD#xxx), cross-references (CR#xxx), full documents
3. **Verification loops**: Reading back files, checking git status, verifying commits
4. **Git operations**: staging, committing, pushing — often with retries

Characteristic summaries from bloated sessions:
- "3 deep dives written (DD#717-719) from those 7 papers" (14 turns — actually efficient!)
- "All files verified. Everything committed and consistent." (69 turns — mostly verification)
- "15 covered IDs (11 original + 4 new). Everything is clean and committed." (56 turns)
- "All committed content verified. Everything matches expectations." (85 turns)

### Cost Analysis (from 21 DB-tracked sessions)

| Session | Ops | Cost | Tokens | Turns |
|---------|-----|------|--------|-------|
| s_...143 | 21 | $2.05 | 627,902 | 31 |
| s_...375 | 15 | $1.76 | 528,086 | 28 |
| s_...84 | 3 | $1.50 | 462,488 | 18 |
| s_...8 | 21 | $1.32 | 384,226 | 33 |
| s_...553 | 13 | $1.05 | 295,481 | 22 |
| **Avg (all 21)** | 10.3 | **$0.48** | 135,814 | — |

Note: High-turn sessions are **disproportionately expensive** due to growing context windows. A 70-turn session doesn't cost 7x a 10-turn session — it costs **10-15x** because each turn carries accumulated context.

### Recent Trend (last 24h, n=49)

| Metric | Last 24h | All-time |
|--------|----------|----------|
| Average turns | 20.8 | 22.4 |
| Bloated (>30) | 16% (8 sessions) | 28% (99 sessions) |
| Max | 85 | 95 |

The recent trend shows slight improvement (16% bloated vs 28% all-time), but the structural problem persists: scout still can't fork.

---

## Root Cause Analysis

### The Mechanical Blocker

**Scout's archetype (`_archetypes/scout/agent.json`)**:
```json
{
  "tools": ["coding", "scrape", "checkpoint", "finish"],
  "opBudget": 25
}
```

**Missing**: `"agents"` tool — required for `agents.fork()`, `agents.call()`, `agents.message()`.

**Compare optimizer (`agents/optimizer/agent.json`)**:
```json
{
  "tools": ["coding", "agents", "workflow", "checkpoint", "finish"]
}
```

Optimizer has `"agents"` and `"workflow"` tools. Scout has neither.

### The Behavioral Consequence

1. Heartbeat.md says "fork substantive work into separate sessions"
2. Scout reads this instruction every heartbeat
3. Scout cannot execute `agents.fork()` because the tool doesn't exist
4. Scout does the only thing it can: does the research inline
5. Heartbeats balloon to 50-95 turns when there's real work to do

### Why opBudget: 25 Doesn't Prevent Bloat

The activity log shows sessions with 85-95 turns, far exceeding the 25-op budget. This is because:
- `opBudget` counts **ops** (tool calls), not **turns** (model responses)
- With compaction enabled, a session can have many turns while staying under the op budget
- The result: high-turn sessions that burn through tokens via accumulated context, but still "fit" under the op cap

---

## Comparison: Scout vs Optimizer Heartbeats

| Metric | Scout | Optimizer (recent 20) |
|--------|-------|-----------------------|
| Average turns | 22.4 | 19.2 |
| Can fork? | **No** | Yes |
| Forked sessions | 0 | 57 work sessions |
| Heartbeat pattern | Observe → do everything inline | Observe → decide → fork → exit |
| Max turns | 95 | 33 |

Optimizer's recent heartbeats (post-dispatcher rewrite) have max=33 turns with most at 7-16. The heavy work (Mode A-D explorations) happens in properly forked work sessions.

---

## Recommendation

### Fix 1: Add `agents` tool to scout archetype (Critical)

Edit `agents/_archetypes/scout/agent.json`:
```json
{
  "tools": ["coding", "scrape", "agents", "checkpoint", "finish"],
  "opBudget": 25
}
```

This single change unblocks the dispatcher pattern that the heartbeat.md already describes.

### Fix 2: Add `workflow` tool (Optional, lower priority)

If scout needs structured multi-step workflows:
```json
{
  "tools": ["coding", "scrape", "agents", "workflow", "checkpoint", "finish"]
}
```

### Fix 3: Verify dispatcher behavior post-fix (Required follow-up)

After deploying Fix 1, monitor for 12-24h:
- Expected: heartbeat avg drops to 8-12 turns
- Expected: work sessions appear (forked from heartbeats)
- Expected: research quality maintained (same work, different session structure)

### Estimated Savings

| Scenario | HB Turns | Work Session Turns | Total | HB Savings |
|----------|----------|--------------------|-------|------------|
| Current (broken) | 22.4 avg | 0 | 22.4/HB | — |
| Fixed (dispatcher) | ~10 avg | ~35 avg (when forked) | same total work | **55% fewer HB turns** |

The total work doesn't decrease — research still happens. But heartbeats become lean and predictable, and the expensive research work is properly isolated in dedicated sessions that can be evaluated and tracked independently.

### Cost Savings Estimate

Based on the 21 DB-tracked sessions ($10.01 total, avg $0.48/session):
- Bloated sessions cost $1-2+ each due to context accumulation
- A lean 10-turn heartbeat + separate work session avoids the compounding context cost
- Estimated **30-40% cost reduction** from eliminating context accumulation in heartbeats
- For 359 sessions extrapolated: ~$50-60 saved over the observation period

---

## Key Insight

This is the same pattern as the optimizer's pre-dispatcher era (avg 56 ops → 17 ops after rewrite), but with a **mechanical root cause** rather than a behavioral one. Optimizer's heartbeat was bloated because the instructions didn't say to fork. Scout's heartbeat is bloated because it **can't** fork — the tool isn't available. The heartbeat instructions are already correct; only the agent.json configuration needs to change.

---

*Optimizer — Session Archaeology (Mode A) — 2026-04-11*
