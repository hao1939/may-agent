# Finding: Coach High-Op Sessions

**Date**: 2025-06-21
**Severity**: Medium — sustained high op usage, not crisis but wasteful

## Summary

Coach consistently runs high-op sessions (avg ~38-40 ops for both `call` and `job` kinds across 834 total sessions >20 ops). The primary drivers are: (1) persistent-task workflow iterations that run 29-52 ops each, (2) heartbeat sessions that exceed their "decide and fork" mandate, and (3) experiment/investigation work sessions that are naturally heavy.

## Evidence

### By-kind aggregates (all time, >20 ops)
- `call` sessions (heartbeats + persistent-task iterations): 137 sessions, avg 37.9 ops, max 101 (`sessions` table query)
- `job` sessions (forked work): 697 sessions, avg 40.5 ops, max 252 (`sessions` table query)

### Heartbeat sessions doing too much work
Coach heartbeats (`heartbeat.md:47-53`) explicitly say "Your job here is to DECIDE what to work on, then fork it" and "After forking, exit within 3 ops." Yet heartbeat sessions regularly hit 21-40 ops:
- Session at 1776808634771: 26 ops — writing briefs, updating projects (`heartbeat.md:47`)
- Session at 1776786025547: 26 ops — committing, checking experiment status
- Session at 1776785243084: 40 ops — "All files are tracked... Everything is committed"
- Session at 1776713341891: 33 ops — scanning multiple agents' metrics

The heartbeat says "exit within 3 ops" after forking (`heartbeat.md:53`), but coach routinely does substantive work (writing files, committing, investigating) inside the heartbeat instead of forking it.

### Persistent-task workflow iterations are expensive
Persistent-task iterations consistently use 29-52 ops each (`sessions` table). These are `kind=call` from workflows, meaning they block the parent. Examples:
- Iteration 25 of coder-quality: 45 ops
- Iteration 6 of breadcrumb-gap: 40 ops  
- Iteration 5 of breadcrumb-gap: 29 ops
- REVIEW ONLY session (explicitly no edits expected): 42 ops

### Forked work sessions are the biggest volume
697 `job` sessions averaging 40.5 ops. These include gym runs, experiment execution, and investigations. Examples:
- Breadcrumb-gap M3 gym comparison: 45 ops (`sessions` table)
- EXP-190 execution: 34 ops
- Breadcrumb investigation: 40 ops

## Root Causes

1. **Heartbeat scope creep** (`heartbeat.md:47-53`): Despite clear "decide and fork" guidance, coach does substantive work (file writes, git commits, multi-agent scanning) in heartbeat sessions. The "exit within 3 ops" rule after forking is not enforced.

2. **Persistent-task iterations lack op budgets**: The persistent-task workflow doesn't cap ops per iteration. Iteration 25 of a task used 45 ops — at that iteration count, each should be very focused.

3. **No op budget in work-session-scaffold** (`agents/coach/skills/work-session-scaffold.md`): The scaffold has checkpoints at ops 30/45/60, implying 60+ ops is expected/normal. This anchors coach to high op usage.

## Recommendations

1. **Enforce heartbeat op cap at 10**: Add a hard instruction in `heartbeat.md` — "This session MUST complete in ≤10 ops. If work requires more, fork it." Current guidance says "exit within 3 ops after forking" but doesn't cap total heartbeat ops.

2. **Add op budget to persistent-task iterations**: Cap each iteration at 20 ops. If iteration N can't finish in 20 ops, it should checkpoint and let iteration N+1 continue.

3. **Lower work-session-scaffold checkpoints** (`agents/coach/skills/work-session-scaffold.md`): Move checkpoints from 30/45/60 to 15/25/35. The current anchors normalize 60-op sessions.

4. **Audit "REVIEW ONLY" sessions**: A session explicitly tagged "no file edits expected" used 42 ops. Review-only sessions should cap at 15 ops.

## Follow-up Actions (do NOT fix in this session)
- Patch `heartbeat.md` with hard op cap
- Patch `work-session-scaffold.md` checkpoint anchors
- Consider whether persistent-task workflow needs per-iteration op limits
