# Finding: Scout 140-op Debugging Session — Technique Analysis

**Date**: 2026-04-14  
**Mode**: C (Skill & Technique Scouting)  
**Session**: `s_1776126136368_484` — Scout, 140 ops, status: done  
**Task**: Trace workflow.run() agent resolution bug (`ctx.agent` resolving to "undefined")

## Outcome

Scout successfully identified root cause: **deployment gap** — the fix existed in source (commit `fc29e7e`) but the running binary predated it. Deliverable written to `agents/tech-lead/workspace/audit-workflow-agent-resolution.md`.

## Op Cost Analysis

- **140 ops for a successful bug investigation** — significantly over budget
- D-o-R budget: SCOPE ≤3, INVESTIGATE ≤10, WRITE ≤5, EXIT 1 = **≤19 ops total**
- Actual: **7.4× over budget** (140 vs 19)
- **However**: the session completed successfully with correct root cause identification

## Technique Patterns Observed

### What Worked
1. **Clear task structure** — D-o-R phase boundaries were specified upfront with op budgets per phase
2. **File list provided** — Key files (workflow-engine.ts, workflow-tool.ts, manager.ts) were named in the task
3. **Root cause was correct** — Identified deployment gap as the actual issue, not a code bug
4. **Deliverable quality** — Clean, well-structured finding with evidence, timeline, severity

### What Was Wasteful (140 ops for a ~19-op task)
1. **No transcript available** — Session dir not preserved, so can't do detailed tool-call-level analysis
2. **But 140 ops for 4-file trace is extreme** — Likely spent excessive ops on:
   - Git archaeology (checking multiple commits, diffing versions)
   - File discovery beyond the specified list
   - Context reading overhead from long conversation history
3. **Compare: Scout Lens C (guard system audit)**: 30 ops. Scout Lens D (overflow.ts): 24 ops. Scout Lens A (context-learn.ts): 22 ops. **This session was 4.7-6.4× more expensive than peer Lens sessions.**

## Scout Session Cost Distribution (last 12h)

| Session Type | Ops | Notes |
|-------------|-----|-------|
| Lens B (workflow bug) | 140 | **Outlier** — deep debugging |
| Heartbeat | 43 | High for heartbeat |
| Lens C (guard audit) | 30 | Reasonable |
| Heartbeat | 27 | Slightly high |
| Lens D (overflow.ts) | 24 | Good |
| Lens A (context-learn) | 22 | Good |
| Heartbeats (×4) | 11-13 | Normal |

**Pattern**: Scout Lens sessions normally cost 22-30 ops. This 140-op session is a **4.7× outlier**.

## Root Cause Hypothesis (for the bloat)

The debugging task required **git archaeology** (checking commits, diffing pre/post versions) which is inherently expensive:
- Each `git show <ref>:<file>` = 1 op
- Each `git log` search = 1 op  
- Verifying the timeline across multiple commits = many ops
- The root cause (deployment gap) required checking what the running binary version was vs current source

**Compare**: Lens C/D sessions analyzed static code structure (read files, trace logic). Lens B required temporal analysis (how did code change over time?) which is fundamentally more expensive.

## Recommendations

### 1. Git Archaeology Pattern (potential skill)
For "works in source but fails at runtime" bugs, teach a 3-step pattern:
1. Check current source (confirms fix exists) — 2-3 ops
2. Check `git log --oneline -5 <file>` for recent changes — 1 op
3. Check if process has been restarted since that commit — 1 op
Total: 4-5 ops instead of exhaustive commit archaeology

### 2. Deployment Gap Detector (potential tool)
A script that compares `last process start time` vs `git log -1 --format=%ct` could instantly identify deployment gaps. Would have reduced this 140-op session to ~10 ops.

### 3. Scout Lens Op Budget Enforcement
Scout Lens sessions have D-o-R phase budgets but no enforcement mechanism. The 140-op session had explicit "≤19 ops" budget but spent 7.4× that. Same issue as Bob P1 read-loop (pre-cap).

## Priority Assessment

- **Impact**: LOW — Scout debugging sessions are rare (1 in last 12h)
- **Frequency**: LOW — This is a one-off outlier, not a recurring pattern  
- **Actionability**: MEDIUM — Deployment gap detector would be quick to build but low ROI given rarity
- **Recommendation**: **No action needed.** Scout Lens sessions are generally well-budgeted (22-30 ops). This was a legitimate deep-dive on a real bug. The 140-op cost produced a correct finding that unblocked workflow.run(). Sometimes deep debugging is worth the cost.
