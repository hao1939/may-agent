# M13: Scheduler Check — Is the Cron Actually Firing?

**Date**: 2026-04-30T07:10Z  
**Status**: SCHEDULER CONFIRMED RUNNING — Coach sessions consumed by project workflow

## Findings

### 1. Scheduler IS Running (Proven by Other Agents)
| Agent | Last Session | Time |
|-------|-------------|------|
| coach | s_1777532984240_658 | 07:10 (THIS session) |
| qa | - | 07:04 |
| scout | - | 06:57 |
| tech-lead | - | 06:55 |
| optimizer | - | 06:51 |
| evaluator | - | 06:47 |
| bob | - | 06:46 |
| amy | - | 06:45 |
| may | - | 06:41 |

All agents have sessions within the last 30 minutes. **The scheduler is actively running.**

### 2. Coach Sessions Are Being Consumed by This Project
The coach's most recent session (s_1777532984240_658) is literally THIS orchestration session — the coach running the `coach-quality` project workflow. It's not a standalone heartbeat that would trigger the 2-phase workflow.

**Root cause identified**: The coach heartbeat IS firing, but it's being used for project orchestration (master-worker pattern), not standalone work. The 2-phase workflow in `coach-heartbeat.ts` would only apply if the heartbeat runner uses it, but the current session shows the coach is receiving project-orchestration tasks instead.

### 3. Architecture Mismatch
The workflow at `agents/coach/workflows/coach-heartbeat.ts` exists and is registered in cron.json, BUT:
- The cron system fires a `heartbeat.trigger` event
- The heartbeat handler loads `heartbeat.md` instructions
- Those instructions tell the coach to check projects and orchestrate work
- The 2-phase workflow is a SEPARATE code path that may not be invoked by the default heartbeat handler

**Key question**: Does the heartbeat runner call the workflow file, or does it just send the heartbeat.md prompt to the LLM directly?

### 4. Compliance Status
- **Structural compliance from 2-phase workflow**: NOT TESTED (workflow never fired independently)
- **Text-based compliance from context.md**: 0% (confirmed across all iterations)
- **Scheduler operational**: YES (all agents have recent sessions)

## Diagnosis

The enforcement mechanism (coach-heartbeat.ts) exists but may not be wired into the actual execution path. The heartbeat system likely:
1. Fires `heartbeat.trigger` event
2. Loads agent's `heartbeat.md` as the task
3. Sends it to LLM with context.md loaded
4. Does NOT invoke the workflow .ts file

The .ts workflow file is dead code unless there's a workflow runner that picks it up instead of the default heartbeat handler.

## Recommendation

**Option A**: Modify `agents/coach/heartbeat.md` to include the GOAL/PLAN/DONE WHEN template directly as mandatory output format. This is the ACTUAL file that gets loaded on each heartbeat.

**Option B**: Wire the workflow .ts file into the heartbeat runner (requires understanding the runtime's workflow dispatch mechanism).

Option A is simpler and more likely to work given our 0% compliance with context.md instructions. The heartbeat.md is the actual task prompt — if the planning structure is part of the task itself rather than general instructions, it may produce better compliance.
