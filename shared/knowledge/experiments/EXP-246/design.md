# EXP-246: Sequential Auditor Production Integration

**Date**: 2027-10-29
**Status**: DESIGNED
**Predecessor**: EXP-242 (Sequential Auditor, 44% vs 0%, p=0.015)
**Author**: bob

## Research Question

Can sequential auditing be integrated into production workflows to improve task outcomes on relational reasoning tasks — and does the 44% lift from gym translate to real sessions?

## Background

EXP-242 proved that a second agent reviewing work from a specialized frame (e.g., "check ordering properties") raises pipeline-order fix rate from 0% to 44% (p=0.015, N=26). This is our strongest validated intervention. But it's only been tested in gym. Production integration requires:

1. **Trigger**: When should the auditor run? (Not every task — that's wasteful)
2. **Routing**: How does the auditor get the right frame?
3. **Feedback loop**: How does auditor output reach the primary agent?
4. **Cost**: ~$0.05-0.10 per auditor call. Acceptable if triggered selectively.

## Design

### Architecture: Guard-Triggered Sequential Review

```
Primary agent completes task
  → finish() guard checks: does this task type match auditor criteria?
  → If yes: spawn auditor agent with specialized frame
  → Auditor reviews primary agent's output
  → If auditor finds issues: block finish(), inject findings as context
  → Primary agent revises with auditor feedback
  → Re-finish (auditor does NOT re-run — one pass only)
```

### Phase 1: Selective Trigger Design

Auditor triggers on tasks matching patterns where single-agent blindness is documented:
- **Ordering/pipeline tasks**: config files with dependency ordering
- **Multi-file consistency**: changes spanning 3+ files that must be consistent
- **Test-vs-code judgment**: test failures where root cause could be test or code

Implementation: Add `auditor_trigger` field to task metadata. For now, manual: the workflow that creates the task tags it.

### Phase 2: Auditor Frame Library

Each trigger type gets a specialized prompt frame:

| Trigger | Auditor Frame |
|---------|--------------|
| ordering | "Review ONLY the ordering of pipeline stages. Are dependencies respected? List any out-of-order items." |
| consistency | "Check cross-file consistency. Do types, names, and interfaces match across all modified files?" |
| test-judgment | "For each failing test, classify: is this a code bug or a test bug? Justify from the test assertion vs. specification." |

### Phase 3: Gym Validation

Before production deployment, validate in gym:
- Run EXP-245 (diagnostic auditor on misleading-test-fix) to test generalization
- If positive (≥30% on behavioral checks from 0% baseline), proceed to production
- If negative, restrict to ordering-type tasks only

### Phase 4: Production Deployment

Wire into the `persistent-task` workflow:
1. Add `afterFinish` hook that checks auditor trigger
2. Auditor runs as a `call` (synchronous sub-agent)
3. If auditor finds issues, return them as finish() rejection reason
4. Measure: task success rate on auditor-eligible tasks before/after

## Success Criteria

1. ≥30% improvement on eligible tasks vs baseline (matching gym results directionally)
2. Auditor triggers on <10% of all tasks (selective, not wasteful)
3. Cost overhead <$0.50/day across all agents
4. No increase in session duration beyond 2 extra turns

## Cost Analysis

- Auditor call: ~$0.05-0.10 (one focused LLM call)
- If 5% of ~50 daily tasks trigger: 2.5 auditor calls/day = $0.12-0.25/day
- ROI: 44% of 2.5 tasks = ~1 task/day saved from failure. Each failed task costs a full retry ($0.50-2.00). Net positive.

## Dependencies

- `agents.call()` already available in workflows
- `finish()` guard mechanism exists (proven in RBE/VAE guards)
- Task metadata tagging: needs design doc or convention

## Risks

- Auditor may not generalize beyond ordering tasks (mitigated by Phase 3 gym test)
- Finish-guard blocking may increase session length (mitigated by one-pass limit)
- Frame library may need per-scenario tuning (start narrow, expand with evidence)
