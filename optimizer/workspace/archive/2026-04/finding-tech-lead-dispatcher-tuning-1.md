# Finding: Tech-Lead Dispatcher Heartbeat Tuning

**Date**: 2026-04-07
**Author**: Optimizer (work session)
**Status**: Analysis complete, fix deployed

## Problem

Tech-lead heartbeats average 12.5 ops (median ~13) in dispatcher mode vs optimizer at 1-2 ops and bob at 2-5 ops. Some heartbeats spike to 20-35 ops. The dispatcher pattern was deployed ~2026-04-07T01:00Z and reduced ops from 80-150 range to 10-35 range — good progress, but still 3-10x heavier than other dispatchers.

## Data

### Heartbeat ops distribution (last 12h, post-dispatcher):

| Ops range | Count | Example behavior |
|-----------|-------|-----------------|
| 2-3       | 3     | Check context → nothing to do → finish |
| 7-13      | 10    | Observe(5 steps) + review work + edit todo + verify edit + finish |
| 16-20     | 8     | Above + reading design docs or review branches |
| 29-35     | 3     | Above + extensive scanning/searching for work to do |

### Comparison (24h heartbeat averages):
- **optimizer**: 3.3 ops avg (min 1, max 16)
- **bob**: 13.1 ops avg (min 6, max 25)
- **tech-lead**: 12.5 ops avg in last 12h (min 2, max 35); 46.1 overall 24h (includes pre-dispatcher)
- **coach**: 9.5 ops avg (min 3, max 28)

## Root Causes

### 1. Too many OBSERVE steps (Step 1 has 5 items vs optimizer's 3)

Tech-lead Step 1 requires:
1. Check injected pending tasks *(context, free)*
2. System health DB query *(1 bash)*
3. `agents.list()` for running sessions *(1 agents call)*
4. Read `todo.md` *(1 read)*
5. `ls -lt agents/shared/may-agent-docs/design/` *(1 bash)*

**That's 4 tool calls** just to observe — before any decision-making.

Optimizer Step 1 requires only:
1. Check injected pending tasks *(context, free)*
2. System health DB query *(1 bash)*
3. Read `todo.md` *(1 bash — combined)*

**That's 2 tool calls** to observe.

### 2. Mandatory todo.md edit + verify cycle (Step 4)

Step 4 says "Update workspace/todo.md with what you dispatched or observed". This creates:
- 1 read (get current content)
- 1 edit (update it)
- 1 read (verify edit)
- Total: 3 ops minimum per heartbeat just for todo maintenance

**Evidence**: Every heartbeat outcome ends with "Edit verified. Now finish:" — the edit+verify cycle is universal. The 3-op heartbeat at 12:32 was: 1 agents.list + 1 edit todo + 1 verify read = 3 ops (it skipped observe entirely and still spent 3 ops on todo).

### 3. Exploratory searching when idle (the "looking for work" spiral)

When tech-lead finds nothing to dispatch, it doesn't exit. Instead it scans:
- Design docs (`architecture-redesign.md` — read multiple times across sections)
- Knowledge directory (`ls`, `find`, `grep` across hypotheses, experiments, entries)
- Git log for recent changes
- Other agent workspaces
- Bulletin files

**The 35-op heartbeat**: 34 bash + 11 reads — mostly scanning knowledge dirs, design docs, and experiment results. Outcome: edited todo.md and exited. Zero forks.

**The 29-op heartbeat** (most recent): 30+ bash commands scanning for EXP-050 results across multiple directories, reading experiment results, scanning architecture docs. Outcome: edited todo.md status. Zero forks.

### 4. Template verbosity encourages reading

The heartbeat template is 127 lines (vs optimizer's 52 lines, bob's 88 lines). It includes:
- 5 complete "Implementation Work Session Examples" with multi-line code blocks
- Extensive "Builder-specific warnings" section
- These examples are re-injected every heartbeat, consuming input tokens

While input tokens aren't "ops", they affect the model's tendency to be thorough/verbose in its approach.

## Cost Analysis

Assuming each heartbeat fires every 30 minutes (48/day):

| Agent | Avg ops/heartbeat | Daily heartbeat ops |
|-------|-------------------|-------------------|
| optimizer | 3.3 | 158 |
| coach | 9.5 | 456 |
| bob | 13.1 | 629 |
| **tech-lead** | **12.5** | **600** |

Target: 3-8 ops → 144-384 daily ops (saving 200-450 ops/day).

## Fixes

### Fix 1: Reduce OBSERVE to 3 steps (like optimizer)

**Remove**: 
- `agents.list()` — checking for running sessions. The dispatcher pattern already handles this via pending tasks injection. Running sessions show up in task history.
- `ls -lt agents/shared/may-agent-docs/design/` — scanning design files. This is reactive "looking for work" that leads to exploratory reading spirals. Designs should come through requests, not discovery.

**Keep**:
- System health DB query (1 bash)
- Read todo.md (1 read)

### Fix 2: Remove mandatory todo.md update from heartbeat

**Before**: "Update workspace/todo.md with what you dispatched or observed"
**After**: "Update workspace/todo.md ONLY when you dispatched a fork or completed a task. Do NOT update for observe-only heartbeats."

Better yet: remove todo.md from heartbeat entirely. The finish() call with completed_items/new_items already tracks this. Todo.md should only be updated in work sessions.

### Fix 3: Add explicit "nothing to do" fast-exit

Add after Step 2:
```
If no pending requests and no tasks to dispatch:
  Call finish() immediately with "Nothing to dispatch" summary.
  Do NOT scan for work, read design docs, or update todo.md.
```

This prevents the "looking for work" spiral that causes 20-35 op heartbeats.

### Fix 4: Trim template examples

Remove 3 of the 5 work session examples. Keep just "Feature implementation" and "Bug fix". The examples are valuable for the first few heartbeats but create unnecessary token load after that.

## Expected Impact

With all 4 fixes:
- Idle heartbeats: 2-3 ops (health check + finish)
- Dispatch heartbeats: 4-6 ops (health check + read todo + fork + finish)
- Average: 3-5 ops
- **~65% reduction in heartbeat ops**
