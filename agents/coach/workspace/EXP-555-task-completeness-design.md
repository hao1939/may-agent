# EXP-555: Task Completeness — Subtask Omission in Multi-Step Work

**Date**: 2026-06-02  
**Author**: coach  
**Status**: DESIGNED  
**Type**: Measurement + Intervention

## Problem

Agents complete the "main" task but skip explicit subtasks. Evidence:
- `output-format-compliance` scenario: agent completed the primary feature but skipped "write a test" (test-written failed)
- `hidden-constraints-refactor`: agent refactored correctly but missed server.js registration (server-updated failed)
- Pattern: agents satisfy the *primary objective* but drop *secondary explicit requirements*

This is distinct from structural interventions (which handle behavioral compliance). This is about **task reading comprehension** — ensuring all stated requirements are fulfilled.

## Hypothesis

A "requirements checklist" structural injection (listing all explicit task requirements before work begins) will reduce subtask omission by ≥30pp.

**Mechanism**: Before acting, agent must extract and list ALL requirements from the task prompt, then check each off during execution.

## Method

### Phase 1: Baseline Measurement

Run 3 multi-requirement scenarios × 3 trials = 9 runs WITHOUT intervention:
1. `output-format-compliance` — has 5 checks including test-writing
2. `hidden-constraints-refactor` — has 7 checks including server registration  
3. `convention-verify-multi-edit-workflow-gated` — has 9 checks including PLAN.md

**Baseline metric**: % of non-primary checks passed (exclude the "obvious" main task check)

### Phase 2: Treatment Design

Inject a "TASK COMPLETENESS RULE" into the scenario coaching:
```
TASK COMPLETENESS RULE:
Before starting work, list ALL requirements from the task description.
After completing work, verify EACH requirement is satisfied.
Do not call finish() until all listed requirements have evidence of completion.
```

### Phase 3: Treatment Measurement  

Same 3 scenarios × 3 trials WITH the injection. Compare non-primary check pass rates.

## Success Criteria

- Baseline: ≤70% pass rate on non-primary checks (confirming the gap exists)
- Treatment: ≥30pp improvement over baseline
- Statistical: consistent across ≥2/3 scenarios

## Connection to Existing Work

- Extends EXP-510 (worker completion requirements) — which is a generic "did you finish?" check
- More specific than EXP-510: targets explicit task requirements, not just "did you write something"
- If positive, could be integrated into master-worker.ts as a requirement-extraction step

## Risk

- If baseline is already ≥80%, gap doesn't exist and experiment is CEILING (like EXP-425)
- If improvement requires task-specific understanding, skill may not generalize

## Timeline

- Phase 1: This session or next (run 9 baseline trials)
- Phase 2-3: Next session (design + measure treatment)
