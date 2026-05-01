# EXP-297: Session-State Disambiguation Guard

**Date**: 2027-09-01
**Status**: DEPLOYED
**Author**: bob
**Priority**: P2

## Problem

Agents confuse "system state" (what exists in the project) with "session state" (what they've done THIS session). This causes ghost completions where an agent reads project.md showing milestones complete and concludes their work is done — without producing any output.

EXP-296 bounded the damage via circuit breaker (6 iterations max) and anti-shallow (≥5/8 tool calls). But the ROOT CAUSE persists: agents lack a mental model of session vs. system.

## Root Cause Analysis

When an agent receives a task like "implement X for project Y":
1. Agent reads project.md → sees "milestone: X — COMPLETE"  
2. Agent concludes "X is already done" → calls finish(status="success")
3. Worker detects 0 files → retries
4. Agent reads same state → same conclusion → loop

The confusion: "X is complete in the system" ≠ "I completed X in this session."

## Hypothesis

**H297**: Adding a session-state primer to the INITIAL worker prompt (not just retry) will reduce first-iteration ghost completions by >50%.

## Proposed Intervention

Add to the worker's initial task prompt (line ~155 area of master-worker.ts):

```
## Session Contract
You are starting a FRESH session. Your job is to produce FILES, not verify state.
- If the task seems "already done": produce a verification report or improvement.
- If truly nothing remains: write a completion-evidence file documenting WHY with specific tool output.
- An empty session (0 files) is always a failure, regardless of project state.
```

## Why This Differs from Anti-Shallow

Anti-shallow forces tool calls but doesn't address the *reasoning* failure. An agent can make 8 tool calls (all read/grep) and still conclude "nothing to do" → produce no files. This guard reframes the agent's goal: your job is OUTPUT, not STATUS CHECKING.

## Measurement Plan

1. **Baseline**: Count first-iteration ghost completions in last 14 days (sessions where iteration 1 produced 0 files AND agent claimed completion)
2. **Deploy**: Add session-state primer to initial worker prompt
3. **Post**: Count same metric over next 14 days
4. **Success**: ≥50% reduction in first-iteration ghost completions

## Risk

Low. Text-only change to prompt. Worst case: agents produce unnecessary "verification report" files. This is acceptable — a small unnecessary file is better than a 6-iteration retry loop.

## Connection to Architecture

This points toward a deeper pattern: **agents need session-scoped identity**. They should track:
- What files I READ this session
- What files I WROTE this session  
- What tools I called this session

The anti-shallow rule and circuit breaker are *external* enforcement. True fix is agents having intrinsic session awareness — knowing "I haven't done anything yet" as a first-class fact.

## Prior Art

- EXP-296: Ghost completion detection (PARTIALLY_VALIDATED)
- EXP-290/295: Anti-shallow rule deployment
- C15.1/C15.2: Output accountability conventions (optimizer)
- KE-338: Text coaching ineffective for behavioral change (but prompt-level changes ARE effective)

## Next Steps

1. Measure baseline ghost completions from evaluation data
2. If baseline > 2/week: deploy intervention
3. If baseline ≤ 2/week: close as "already mitigated" by existing guards
