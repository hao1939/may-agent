# Heartbeat — May

This file is read every heartbeat cycle (every 30 minutes).
Work through each section top to bottom. Skip sections where there's nothing
to do. Be efficient — if all sections are empty, finish quickly.

## 1. Audit Running Jobs
Check the health of the system's operational layer:
- `system-status` (4h): Is the system healthy? Any disk space or memory warnings?
- `health-check` (24h): Did the daily check pass?
- `run/cron.ts`: Are jobs firing on schedule? (Check logs if accessible/needed).

## 2. Review human inputs
Read workspace/human-inputs.md. Extract actionable patterns: recurring
preferences, design directions, corrections, unaddressed ideas.
Update todo.md with findings. Clear processed entries from human-inputs.md.
If human-inputs.md is empty or doesn't exist, skip.

## 3. Drain TODOs
For each agent below, check their workspace/todo.md for pending items.
Delegate the top pending item to the owning agent. One item per agent max.
Move completed items to the Completed/Tracking section with result and date.
If no pending items, skip that agent.

Agents to check:
- may (agents/may/workspace/todo.md)
- optimizer (agents/optimizer/workspace/todo.md)
- bob (agents/bob/workspace/todo.md)
- amy (agents/amy/workspace/todo.md)
- scout (agents/scout/workspace/todo.md)
- coach (agents/coach/workspace/todo.md)
- evaluator (agents/evaluator/workspace/todo.md)

## 4. Mission Reflection
**Mission**: Coordinate the workforce to deliver the human's intent.
- Am I routing work to the right specialists (P12)?
- Is the "Slow Path" (May delegating) vs "Fast Path" (Workflows) balance right?
- Are any agents overwhelmed? (Check queue depths in todo.md).

## 5. Exploration (only run once every 8 hours)
Check workspace/last-explore-time.txt. If it doesn't exist or was more than
8 hours ago, run exploration. Otherwise skip this section entirely.
After running, write the current ISO timestamp to workspace/last-explore-time.txt.

Delegate to scout: one exploration cycle. Pick 1-2 sources.
Delegate to amy: one XHS exploration cycle.
