# EXP-185 Results: Heartbeat Auto-Detection for Persistent-Task Workflow

**Date**: 2026-04-19
**Status**: CONCLUDED
**Predecessor**: EXP-184 (struct-v2 = ~50%, task-level = ~100%)

---

## Research Question

Can injecting a "check for active projects" step at the task level raise persistent-task adoption above 80%?

## Method

Created scenario variant `use-persistent-task-autodetect` — identical to `use-persistent-task` but with Step 0 prepended to task.md:

```
## Step 0: Check for Active Projects
Before starting work, check if you have active multi-session projects:
- Read your workspace/projects/ directory
- If any project has status: active with iteration tracking, use:
  workflow.run("persistent-task", { task: "<project goal>", project: "<path>" })
- Do NOT work on multi-session projects without the persistent-task workflow
```

No lab fork overrides (no SOUL.md or skill changes) — testing the Step 0 injection in isolation.

Ran 10 trials via: `scripts/gym-batch.sh --scenario use-persistent-task-autodetect --trials 10 --agent bob`

## Results

| Arm | N | Pass | Rate |
|-----|---|------|------|
| Baseline (no intervention) | 7+ | 0 | 0% |
| Auto-detect Step 0 only | 10 | 0 | 0% |
| struct-v2 (SOUL + skill + context.md) | 13 | 7 | ~54% |

### Pass rate: 0/10 (0%)

**Hypothesis H-185a FALSIFIED.**

## Analysis

The Step 0 instruction was task-level (highest compliance tier per EXP-184), yet achieved 0%. Why?

1. **The instruction was generic, not actionable**: Step 0 says "check workspace/projects/ directory" and "if any project has status: active... use workflow.run()". This requires the agent to (a) read the directory, (b) read each file, (c) detect status, (d) formulate the workflow call. Too many inference steps.

2. **The agent doesn't use the gym work directory**: In all 10 trials, the agent ran `ls agents/bob/workspace/projects/` from `/app` (real workspace) instead of the gym work directory, found no `test-project.md`, and immediately finished as blocked. The "Work in this directory:" prefix was ignored.

3. **Contrast with EXP-184 STEP variant (100%)**: The STEP variant embedded the *exact* workflow.run() call in the task — zero inference needed. Step 0 here required the agent to construct the call itself.

## Key Insight

**Generic procedural instructions at task level ≠ task-level compliance.** The EXP-184 finding that "task-level > system-prompt" holds for *specific* instructions, not *procedural meta-instructions*. A meta-instruction like "check for X and if Y then do Z" is still a multi-step inference chain that agents skip under time pressure.

The effective intervention hierarchy is:
1. **Exact command in task** (100% — EXP-184 STEP)
2. **Skill + SOUL + context.md** (~54% — struct-v2)
3. **Generic procedural step in task** (0% — this experiment)
4. **Context.md only** (0% — EXP-184 baseline)

## Decision

Falsified. The heartbeat auto-detection approach as designed does not work. A production deployment would need to inject the **exact workflow.run() call** (not a generic "check and decide" instruction) — essentially what the STEP variant did.

## Next Steps

- Consider EXP-186: Have the heartbeat handler *programmatically* detect active projects and inject the exact `workflow.run("persistent-task", ...)` call into the task, rather than asking the agent to detect and decide.
- The infrastructure issue (agents ignoring gym work directory) may also affect other scenarios — worth investigating separately.
