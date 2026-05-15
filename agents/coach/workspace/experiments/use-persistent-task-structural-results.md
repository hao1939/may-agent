# use-persistent-task: Structural Intervention Results

**Date**: 2026-04-18
**Investigator**: Coach
**Status**: Preliminary (some runs still in progress)

## Research Question

Can structural interventions (context.md injection, heartbeat bash block modification) improve persistent-task workflow adoption compared to text-only instructions?

## Interventions Tested

### 1. Heartbeat bash block modification (lab fork: struct-persistent-task)
- Added `&& bash agents/bob/scripts/check-active-projects.sh bob` to Step 1 bash block
- The script outputs a prominent ASCII banner with exact `workflow.run()` command
- **Result**: 0/5 used workflow (0%)
- **Why it failed**: In oneshot gym mode, agents receive a specific task ("Resume your active project") and skip the heartbeat bash flow entirely. The intervention is never seen.

### 2. Context.md CRITICAL instruction (same lab fork, added later)
- Added to first line of context.md: `**CRITICAL: When you have an active project (Status: active in workspace/projects/), ALWAYS resume it using workflow.run("persistent-task", "project: <path>\nagent: bob\ngoal: <goal>"). Do NOT do the work inline — use the persistent-task workflow.**`
- Context.md is injected into "What You Know" section of every session prompt
- **Result**: 2/4 used workflow (50%)

### 3. Baseline (no intervention)
- This batch: 0/5 used workflow (0%)
- Previous RUN variant (task.md instruction): ~60% (from clean-results.md)

## Key Findings

1. **Heartbeat bash modifications are invisible in oneshot mode** — agents skip the bash block when given a direct task. Structural interventions in heartbeat.md only work if the agent follows the heartbeat flow.

2. **Context.md injection works at ~50%** — better than baseline (0%) but not reliable. The instruction is in the prompt but agents still ignore it half the time.

3. **The prior "RUN" variant (~60%) put instructions in task.md** — task.md text is read first and has higher salience than context.md bullet points. This explains why RUN > context.md.

4. **No intervention achieves >60% on this scenario** — suggesting the behavior gap is fundamentally about agents preferring inline work over workflow delegation, not about visibility of instructions.

## Implication

The hierarchy of intervention effectiveness for workflow adoption:
- **Task-level instruction** (~60%): Highest salience but not sustainable (can't add to every task)
- **Context.md injection** (~50%): Moderate, persistent, but buried in long context
- **Heartbeat bash block** (0%): Invisible in oneshot/direct-task scenarios
- **Heartbeat text instructions** (baseline ~20-40%): Low reliability

True structural fix would need to be at the **runtime level**: auto-detect active projects and inject workflow call into the agent loop, or add a guard that rejects finish() without workflow use.

## Files Created
- `agents/.lab/struct-persistent-task/context.md` — context.md with CRITICAL instruction
- `agents/.lab/struct-persistent-task/heartbeat.md` — heartbeat with bash script call
- `agents/bob/scripts/check-active-projects.sh` — active project detector script
