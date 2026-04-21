# Breadcrumb Action Rate — Investigation

**Date**: 2026-04-21
**Baseline**: 0.4375 (7/16 measurable sessions acted on breadcrumbs)
**Target**: 0.80

## Measurement Setup

The script (`measure-breadcrumb-action-rate.sh` v3) finds sessions where `BELOW TARGET` appeared in the agent's heartbeat task text, then checks session digests for evidence of metric-related action.

In the 7-day window: 18 sessions had breadcrumbs in prompt, 16 had digests, 7 acted = 43.8%.

## The 9 Non-Acting Sessions — Analysis

### Session-by-session breakdown

| # | Session | Agent | Breadcrumb | What happened | Failure mode |
|---|---------|-------|-----------|---------------|-------------|
| 1 | s_...349_2 | coach | breadcrumb-action-rate: 0.20 | Tried to run EXP-190 but got aborted (missing module) | **FM-1: Interrupted** — session crashed before addressing metric |
| 2 | s_...529_11 | may | alert-to-reaction-time: 136s | "Working tree is clean" — housekeeping only | **FM-2: Housekeeping crowded out** |
| 3 | s_...542_13 | coach | breadcrumb-action-rate: 0.20 | "No coach changes to commit" — finish blocker cleanup | **FM-2: Housekeeping crowded out** |
| 4 | s_...021_21 | may | alert-to-reaction-time: 136s | "Read-only monitoring heartbeat" | **FM-3: Read-only session** |
| 5 | s_...078_32 | may | alert-to-reaction-time: 136s | "Clean working tree now" | **FM-2: Housekeeping crowded out** |
| 6 | s_...355_43 | may | alert-to-reaction-time: 136s | "Read-only heartbeat" | **FM-3: Read-only session** |
| 7 | s_...361_1 | may | alert-to-reaction-time: 136s | "Restored that file" — file recovery | **FM-2: Housekeeping crowded out** |
| 8 | s_...096_11 | may | alert-to-reaction-time: 136s | "Read-only monitoring heartbeat" | **FM-3: Read-only session** |
| 9 | s_...658_22 | may | alert-to-reaction-time: 136s | "Read-only monitoring heartbeat" | **FM-3: Read-only session** |

### Failure Mode Categories

**FM-1: Session interrupted/crashed (1/9 = 11%)**
- Session aborted before the agent could address breadcrumbs
- Not a breadcrumb design problem — infrastructure issue

**FM-2: Housekeeping crowded out breadcrumbs (4/9 = 44%)**
- Agent spent entire session on git cleanup, file recovery, working tree issues
- The breadcrumb was visible but the agent prioritized immediate housekeeping
- Root cause: breadcrumbs are passive — they sit in the prompt but don't compete with active problems

**FM-3: Read-only monitoring sessions (4/9 = 44%)**
- May's heartbeats often do nothing — just check status and exit
- The breadcrumb was there but the agent's self-concept of the session was "monitoring only"
- Root cause: agent treats heartbeat as check-in, not action session

## Key Insights

1. **It's a may problem**: 7 of 9 failures are may. Coach acts on its breadcrumb ~70% of the time (5/7), may acts ~20% (2/9).

2. **may ignores its own breadcrumb repeatedly**: The same breadcrumb (`alert-to-reaction-time: 136s`) appeared in 9 consecutive may sessions with no action in 7 of them. The agent sees it, doesn't act, sees it again next heartbeat, still doesn't act.

3. **Breadcrumb format is fine**: The `📊 metric: value (target X) ⚠️ BELOW TARGET` format is clear enough — coach acts on it. The problem is agent behavior, not breadcrumb clarity.

4. **"Read-only heartbeat" is the dominant anti-pattern**: May has learned to do minimal heartbeats — check status, report clean, exit. Breadcrumbs can't break through this pattern because they're informational, not imperative.

## Root Cause

The breadcrumb is **informational** ("here's a metric that's low") rather than **directive** ("you must investigate X this session"). Agents with a strong self-directed agenda (coach) act on them. Agents that default to passive monitoring (may) ignore them.

## Recommended Intervention

See `plan.md` for the concrete intervention design.
