# EXP-185: Heartbeat Auto-Detection for Persistent-Task Workflow

**Date**: 2026-04-18
**Status**: DESIGNED
**Predecessor**: EXP-184 (struct-v2 = ~50%, task-level = ~100%)
**Project**: instruction-following / persistent-task-adoption

---

## Research Question

Can injecting a "check for active projects" step into the heartbeat template — one that detects multi-session projects and suggests `workflow.run("persistent-task", ...)` in the task output — raise persistent-task adoption above 80%?

## Hypothesis

- **H-185a**: A heartbeat step that programmatically detects active projects and injects a workflow suggestion into the agent's immediate context will achieve ≥80% persistent-task adoption (vs 0% baseline, ~50% struct-v2).
- **H-185-null**: The agent still ignores the suggestion and does work inline.

## Rationale

EXP-184 established the instruction hierarchy: task-level > system-prompt. The ~100% pass rate of STEP variant proves that if the workflow instruction appears in the task itself, agents comply. This experiment bridges the gap: instead of requiring humans to write task-level instructions, the heartbeat auto-detects the need and injects the instruction dynamically.

This is a **structural intervention** (KE-007) that works at the task level (highest compliance tier per EXP-184).

## Design

### Intervention

Modify the gym scenario's heartbeat handler (or the agent's heartbeat template) to include:

```
## Step 0: Check for Active Projects
Before starting work, check if you have active multi-session projects:
- Read your workspace/projects/ directory
- If any project has status: active with iteration tracking, use:
  workflow.run("persistent-task", { task: "<project goal>", project: "<path>" })
- Do NOT work on multi-session projects without the persistent-task workflow
```

This step appears **before** the agent's normal work steps, making it the first thing processed (task-level position).

### Arms

| Arm | Intervention | N | Notes |
|-----|-------------|---|-------|
| A (baseline) | No intervention | 7+ | Use existing 0% data |
| B (auto-detect) | Heartbeat step 0 with project detection | 10 | New runs |

### Scenario

`use-persistent-task` (existing gym scenario, no changes needed)

### Metrics

- Primary: pass rate (did agent call `workflow.run("persistent-task", ...)`)
- Secondary: did agent read workspace/projects/ before acting?

### Decision Rule

- Confirmed if B ≥ 80%
- Partially confirmed if B ≥ 50% but < 80%
- Falsified if B < 50%

## Execution Plan

1. Create lab fork `heartbeat-autodetect` from bob's config
2. Modify heartbeat template to include Step 0 above
3. Run `scripts/gym-run.sh use-persistent-task --agent bob --lab heartbeat-autodetect` × 10
4. Score results

## Risk

- The gym scenario uses oneshot mode — heartbeat template may not be used. Need to verify that the scenario's task.md or handler actually processes heartbeat content.
- If oneshot skips heartbeat, alternative: inject Step 0 into the scenario's task.md directly (simulating what a real heartbeat would produce).

## Notes

This experiment tests the **production deployment path**: if it works in gym, the real deployment is adding this step to agents' actual heartbeat handlers, which would auto-trigger persistent-task for all multi-session work without requiring per-task instructions.
