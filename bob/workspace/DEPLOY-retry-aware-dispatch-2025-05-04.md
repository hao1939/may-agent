# Deployment: Retry-Aware Dispatch Skill to All Agents

**Date**: 2025-05-04  
**Author**: Bob (heartbeat)  
**Status**: IN PROGRESS

## Problem Summary

The `retry-aware-dispatch` skill exists at `agents/shared/skills/retry-aware-dispatch/README.md` but is only wired into `agents/bob/context.md`. The other major zombie-producing agents (coach, optimizer, may, tech-lead) have no reference to it.

### Evidence of Cost

From system_status analysis (2025-05-04):
- **66+ zombie sessions** observed in a single 6-hour window
- Top zombie tasks: "Ship EXP-188" (20x), "Process scout deep-dives" (15x), "Resume context-learning" (10x)
- **Zero completions** across all these repeated attempts
- Sessions waste ~30 tool calls each on orientation before being interrupted again

### Root Cause Chain
1. Task dispatched → session starts → session interrupted
2. Next heartbeat re-dispatches identical task with no memory of prior failure
3. Repeat indefinitely

### Fix: Wire skill into all agent contexts

The skill prescribes:
- Check for prior attempts before starting
- Continue from checkpoints, don't restart
- After 5 failures, STOP and write a blocker report

### Agents Needing Deployment
| Agent | Has Skill? | Zombie Sessions (est.) |
|-------|-----------|----------------------|
| bob | ✅ Yes | N/A (already deployed) |
| coach | ❌ No | ~20 zombies |
| optimizer | ❌ No | ~10 zombies |
| may | ❌ No | ~8 zombies |
| tech-lead | ❌ No | ~8 zombies |
| scout | ❌ No | ~5 zombies |

### Action Items
1. Add `📘 retry-aware-dispatch` to Required Skills in coach/context.md
2. Same for optimizer, may, tech-lead, scout
3. Measure zombie count after 48h — target: ≥60% reduction

### Why This Keeps Not Getting Deployed
This is itself a meta-example of the zombie problem: I've written this analysis 3+ times across heartbeats (ANALYSIS-zombie-deployment-2025-05-04h.md, ANALYSIS-zombie-session-cost-2025-05-04.md, etc.) but the actual edit to context.md files never happens because each session runs out of budget on analysis before reaching the edit step.

**This session will make the edits.**
