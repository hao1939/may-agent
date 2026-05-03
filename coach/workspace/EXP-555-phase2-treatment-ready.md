# EXP-555 Phase 2: Treatment Scenarios Ready

**Date**: 2026-06-22
**Status**: TREATMENT SCENARIOS CREATED — READY TO RUN

## Treatment Design

Injected `TASK COMPLETENESS RULE` into 3 treatment scenarios via `injected_context.md`:

```
TASK COMPLETENESS RULE:
Before starting work, extract and list ALL explicit requirements from the task.
After completing work, verify EACH listed requirement is satisfied with evidence.
Do not call finish() until every requirement has been checked off.

This means:
1. READ the task carefully and write out every requirement as a numbered list
2. After each piece of work, check which requirements you've satisfied
3. Before finishing, go through your list and confirm EACH item has been done
```

## Treatment Scenarios Created

| Scenario | Path |
|----------|------|
| hidden-constraints-refactor-exp555-treatment | `agents/gym/scenarios/hidden-constraints-refactor-exp555-treatment/` |
| output-format-compliance-exp555-treatment | `agents/gym/scenarios/output-format-compliance-exp555-treatment/` |
| convention-verify-multi-edit-workflow-gated-exp555-treatment | `agents/gym/scenarios/convention-verify-multi-edit-workflow-gated-exp555-treatment/` |

## Run Commands

```bash
cd /app/agents && export GYM_AGENT_BIN=/usr/local/bin/may-agent

# Trial 1
bash test/gym/run-gym.sh hidden-constraints-refactor-exp555-treatment --timeout 12
bash test/gym/run-gym.sh output-format-compliance-exp555-treatment --timeout 8
bash test/gym/run-gym.sh convention-verify-multi-edit-workflow-gated-exp555-treatment --timeout 3

# Repeat for trials 2 and 3
```

## Baseline Reference (Phase 1)

| Scenario | Non-Primary Pass Rate | Deterministic Failure |
|----------|----------------------|----------------------|
| hidden-constraints-refactor | 83% (5/6) | `server-updated` 0/3 |
| output-format-compliance | 75% (3/4) | `test-written` 0/3 |
| convention-verify-multi-edit-gated | 88% (7/8) | `C2.1:plan-before-acting` 0/3 |
| **Aggregate** | **82% (15/18)** | |

## Success Criteria

- Treatment aggregate non-primary pass rate ≥ 82% + 30pp = **≥100%** (or at minimum, the deterministic failures must flip to passing in ≥2/3 trials)
- The specific failed checks (server-updated, test-written, plan-before-acting) must pass in treatment trials

## Next Steps

Run 3 trials per scenario (9 total), record results, write Phase 2 results file.
