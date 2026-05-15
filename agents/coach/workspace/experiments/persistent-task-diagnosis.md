# Diagnosis: use-persistent-task Gym Scenario Failures

**Date:** 2026-04-18  
**Investigator:** Coach  
**Status:** Complete

## Summary

The use-persistent-task scenario has a ~70-80% failure rate even with explicit RUN instructions. Root cause analysis of 244 leftover gym transcripts reveals **3 distinct failure modes**, two of which are infrastructure/scenario bugs, not agent behavioral issues.

## Methodology

Analyzed transcript.jsonl files from 244 leftover gym temp dirs (`/tmp/gym-run-*/`). Identified 8 sessions with `workflow` tool calls (passes) vs ~10 RUN-arm failures without.

## Failure Modes

### FM-1: "No workflow tool available" (4/10 RUN failures, ~40%)

**What happens:** Agent reads the project file, then calls `finish(blocked)` saying "No workflow tool is available in this session." Example:

> "Cannot run the persistent-task workflow — no workflow tool is available in this session (only read/bash/edit/write/checkpoint/finish)"

**Root cause hypothesis:** The `workflow` tool IS registered (bob's agent.json includes it), but the agent sometimes doesn't "see" it in the Anthropic API tool definitions. This could be:
- A race condition in tool registration during oneshot mode
- The agent simply doesn't explore its tool list and assumes based on common tools it sees
- The `Available Tools` system prompt section is NOT being injected (confirmed: no "Available Tools" text found in any transcript's system prompt)

**Recommended fix:** Add `## Available Tools` line to the system prompt in gym runs. The `buildSystemPrompt` function in `gym-runner.ts:1401` reads agent.json tools, but this only fires if `agentDir/agent.json` exists AND is valid. Verify this path resolves correctly in all gym modes.

### FM-2: "Project file does not exist" (4/10 RUN failures, ~40%)

**What happens:** Agent looks for `agents/bob/workspace/projects/test-project.md` at the real `/app/agents/bob/` path instead of the gym workDir copy. The file doesn't exist there (it's at `workDir/agents/bob/workspace/projects/test-project.md`).

**Root cause:** The task.md says `agents/bob/workspace/projects/test-project.md` (relative path). The gym workDir copies this file into `<workDir>/agents/bob/workspace/projects/test-project.md`. But:
- CWD is set to workDir, so relative path should work
- However, AGENTS_ROOT points to real `/app/agents/` where no test-project.md exists
- The agent may `ls /app/agents/bob/workspace/projects/` and see real files, not the gym sandbox

**Evidence:** Agent summaries say "confirmed via ls showing..." and list real project files (exp166-execution.md, learn-from-existing-systems.md) that exist in production but not in the gym environment.

**Recommended fix:** Either:
1. Set AGENTS_ROOT to the workDir agents copy (but this breaks workflow loading)
2. Pre-populate the project file in the sandbox agents dir (AGENTS_ROOT path)
3. Use absolute workDir path in task.md

### FM-3: Agent does work inline (2/10 RUN failures, ~20%)

**What happens:** Agent reads the project file, understands the goal, and starts doing the actual project work (measuring startup overhead, writing iteration logs) instead of calling `workflow.run()`.

**Root cause:** This is genuine agent behavior — the agent takes the most direct path to the goal rather than using the prescribed workflow tool. This is the only true "behavioral" failure mode.

**Recommended fix:** This is the only mode where coaching/skills could help. But at only 20% of failures, fixing FM-1 and FM-2 would raise the pass rate from ~33% to ~80%+.

## Pass Rate Projections

| Scenario | Current | After fixing FM-1+FM-2 |
|----------|---------|----------------------|
| RUN arm | 5/13 (38%) | ~11/13 (85%) |
| STEP arm | 2/10 (20%) | ~6/10 (60%) |
| Baseline | 0/69 (0%) | 0/69 (0%) |

## Recommended Actions

1. **P0: Fix FM-2 (file not found)** — Copy environment files to AGENTS_ROOT sandbox path, not just workDir. Or adjust scenario to use a path that resolves correctly.
2. **P1: Investigate FM-1 (tool not visible)** — Add debug logging to verify workflow tool registration in oneshot mode. Ensure `Available Tools` system prompt section fires.
3. **P2: Accept FM-3 (inline work)** — This is a genuine behavioral gap but low-priority given it's only 20% of failures.

## Key Insight

**This is primarily an infrastructure/scenario bug, not a coaching problem.** 80% of failures are caused by the agent either not seeing the workflow tool or not finding the project file — both are gym setup issues. The experiment data from EXP-use-persistent-task-structural.md was measuring scenario bugs, not agent behavior.
