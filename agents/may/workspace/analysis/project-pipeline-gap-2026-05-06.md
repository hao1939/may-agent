# Analysis: Project Pipeline Gap — 2026-05-06

## Problem Statement

The system has **0 active projects** (target: 1). All work streams have either completed or stalled. This creates idle capacity across agents and violates Hao's preference P11: "Never coast — target met → raise bar or find new problems."

## Current Project State

| Project | Status | Owner | Progress | Issue |
|---------|--------|-------|----------|-------|
| hao-alignment | blocked | may | 27/31 | Idle 50+ iterations. Waiting for new Hao interaction or June re-scan. Should be `waiting` not `blocked`. |
| proof-of-life-dashboard | waiting | tech-lead | 5/8 | Feature-complete, awaiting Hao feedback on metric selection (M4). |
| All others | closed/archived | various | — | Completed successfully. |

## Root Cause Analysis

1. **Successful completion wave**: The system completed ~15 projects across 2+ weeks (documentation-gen, test-coverage, skill-workflow-audit, gym-quality-improvement, etc.). This is good.
2. **No pipeline replenishment**: After completing projects, no new ones were created to fill the gap.
3. **hao-alignment status mismatch**: This project is marked `blocked` but should be `waiting` — it's not stuck on a dependency, it's waiting for a trigger event (new Hao interaction). This inflates the "blocked >6h" metric unnecessarily.

## Idle Agent Capacity

With 0 active projects, these agents have no primary work assignments:
- **tech-lead**: Only waiting project (proof-of-life) needs human input
- **bob**: No active work
- **coach**: All projects closed
- **optimizer**: All projects closed

Agents still do heartbeat/maintenance work, but no directed project work is happening.

## Recommendations

### Immediate (this session)
1. **Fix hao-alignment status**: Change from `blocked` to `waiting` — it's not blocked, it's event-triggered. This fixes the ">6h blocked" metric alert.
2. **Message tech-lead**: Ask about proof-of-life-dashboard — can M4 be closed as "awaiting async feedback" and the project marked complete?

### Short-term (needs new project creation)
Candidate projects based on system state:
- **Eval quality improvement**: Eval Quality was 0.43 🔴 in the last dashboard reading. This is a real gap.
- **Handler error investigation**: 2 failures in 6h (metrics-snapshot had 2 errors out of 19 runs). Minor but pattern worth understanding.
- **Daily digest handler resurrection**: `agents/may/handlers/daily-digest.ts` is documented as MISSING from disk. The cron fires but the handler doesn't exist. This is broken infrastructure.

### Strategic
- Build a "project idea backlog" that gets automatically populated from:
  - Red metrics (eval quality)
  - Recurring escalations
  - Human requests
- Auto-propose new projects when active count hits 0

## Action Items for May

1. Update hao-alignment status: `blocked` → `waiting`
2. Investigate daily-digest.ts missing file — this may be causing silent failures
3. Consider creating a new project around eval quality or system observability
