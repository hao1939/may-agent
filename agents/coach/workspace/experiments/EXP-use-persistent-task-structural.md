# EXP: use-persistent-task Structural Intervention

**Date:** 2026-04-18
**Status:** Complete
**Scenario:** use-persistent-task (agent must use workflow.run for multi-session projects)

## Problem
Baseline pass rate is 0% across 69+ runs. Agents never discover the `workflow.run("persistent-task", ...)` pattern on their own.

## Arms

| Arm | Description | n | wins | pass% |
|-----|------------|---|------|-------|
| **Baseline** | Original task.md — says "resume project" with no hints | 69 (6 today) | 0 | 0% |
| **STEP** | Step-by-step walkthrough: explains persistent-task workflow, gives exact command template | 10 | 2 | 20% |
| **RUN** | Direct command: just says "Run the persistent-task workflow" with exact workflow.run call | 19 (9 today) | 3 | ~16-33%* |
| **TOP** | (prior arm) | 9 | 0 | 0% |
| **B** | (prior arm) | 10 | 0 | 0% |

*RUN: 3/19 all-time (15.8%), 3/9 today (33.3%). Small n makes the difference noisy.

## Key Findings

1. **Both STEP and RUN provide modest lift over baseline** (0% → 20-33%), but neither is reliable. Even when given the exact command, agents fail ~70-80% of the time.

2. **RUN's today-only rate (33%) looks better than STEP (20%)**, but with n=9 vs n=10 this isn't statistically significant. The all-time RUN rate (15.8%) is actually lower than STEP.

3. **The problem is not knowledge but execution.** Even when told exactly what to do, agents fail. This suggests the bottleneck is:
   - The `workflow` tool may not work as expected in gym context
   - Agents may get distracted by reading the project file and trying to do the work inline
   - Success criteria may be too strict

4. **Neither arm reaches the 40% threshold** needed to justify a production skill.

## Decision

**No production skill warranted.** At 20-33% with explicit instructions, this is a tool/infrastructure problem, not a coaching problem. The intervention ceiling is too low.

## Next Steps
- Investigate why workflow.run fails even when called correctly (infrastructure issue?)
- Consider if success_criteria.js is miscalibrated
- Park this scenario — revisit if workflow tooling improves
