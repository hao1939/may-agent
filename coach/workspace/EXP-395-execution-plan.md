# EXP-395 Execution Plan: Finish Evidence Quality Correlation

**Date**: 2025-07-03
**Status**: READY TO RUN
**Priority**: P1 — Addresses #1 failure pattern (VERIFICATION_FAILURE, 9 occurrences in evaluations)

## Context

From evaluation data analysis:
- **VERIFICATION_FAILURE**: 9 occurrences (most common)
- **INSTRUCTION_NONCOMPLIANCE**: 7 occurrences  
- **SCOPE_DRIFT**: 2 occurrences

EXP-395 directly tests whether enriched verification evidence instructions reduce verification failures.

## Scenarios Built (confirmed)

| Arm | Scenario | Treatment |
|-----|----------|-----------|
| A (control) | `convention-verify-multi-edit-exp395-arm-a` | Standard verification_evidence |
| B (enriched) | `convention-verify-multi-edit-exp395-arm-b` | Enriched: exact path + specific content + before/after |

Both scenarios have:
- `task.md` — Fix 3 config files (database.json port, cache.json ttl, api.json rateLimit)
- `success_criteria.js` — Checks product correctness (6 checks) + C1 read-before-edit + C2.3 verify-after-edit
- `environment/` — Config files with wrong values

## Execution Steps

### Step 1: Baseline Runs (Arm A)
```bash
# Run Arm A × 3 trials
node agents/gym/run-synthetic.js convention-verify-multi-edit-exp395-arm-a  # trial 1
node agents/gym/run-synthetic.js convention-verify-multi-edit-exp395-arm-a  # trial 2  
node agents/gym/run-synthetic.js convention-verify-multi-edit-exp395-arm-a  # trial 3
```

### Step 2: Treatment Runs (Arm B)
```bash
# Run Arm B × 3 trials
node agents/gym/run-synthetic.js convention-verify-multi-edit-exp395-arm-b  # trial 1
node agents/gym/run-synthetic.js convention-verify-multi-edit-exp395-arm-b  # trial 2
node agents/gym/run-synthetic.js convention-verify-multi-edit-exp395-arm-b  # trial 3
```

### Step 3: Score & Compare
```bash
# Score all runs
node agents/gym/scenarios/convention-verify-multi-edit-exp395-arm-a/success_criteria.js <work_dir>
node agents/gym/scenarios/convention-verify-multi-edit-exp395-arm-b/success_criteria.js <work_dir>
```

### Step 4: Analysis
Compare:
- Product pass rate (6 checks): Arm A vs Arm B
- C1 compliance: Arm A vs Arm B
- C2.3 compliance: Arm A vs Arm B (primary metric)
- Did enriched evidence catch self-corrections? (manual inspection)

## Success Criteria
- **Positive**: Arm B achieves ≥20pp higher C2.3 compliance than Arm A
- **Null**: No difference → enriched instructions don't help, the basic requirement is sufficient
- **Negative**: Arm B scores lower → enriched instructions are distracting/harmful

## Decision Rules
- **If positive**: Deploy enriched evidence format to all agents via context.md updates
- **If null**: Keep current format, investigate other interventions for VERIFICATION_FAILURE
- **If negative**: Simplify current evidence requirements

## Connection to Broader Strategy

This experiment connects the evaluation data (VERIFICATION_FAILURE = #1 pattern) to a concrete skill intervention. The SCORECARD shows:
- Verify-After-Edit: only 22% system-wide activation (EXP-248)
- Structural enforcement works 4× better than text (KE-405)
- VAW guard alone got only 9%→31% (EXP-300)

If EXP-395 shows enriched instructions work, it's a text-based solution. If not, it confirms KE-405 that only structural enforcement works for verification behaviors.

## Blocked On
- Gym runner availability (run-gym.sh not found; need to identify correct runner)
- Alternative: fork to gym agent for execution
