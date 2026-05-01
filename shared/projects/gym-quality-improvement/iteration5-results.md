# Iteration 5 Results

## Summary

Created all 5 workflow variants for the failing scenarios. Gym runner infrastructure not found (no run.sh, package.json, or Makefile at gym root level — scenarios appear to be run by the experiment system, not manually).

## Workflow Variants Created

All 5 failing scenarios now have workflow counterparts:

| Base Scenario | Workflow Variant | Key Mechanism |
|---|---|---|
| silent-data-corruption | ✅ (iter 4) | Phase 1: DATA-AUDIT.md before code changes |
| truncated-schema-migration | ✅ (iter 4) | Phase 1: SCHEMA-AUDIT.md before schema edits |
| **build-activation-gap** | ✅ NEW | Phase 1: DEPLOYMENT-STATUS.md — verify running state before declaring done |
| **ambiguous-context-drift** | ✅ NEW | Phase 1: STATE-AUDIT.md — verify filesystem vs claimed context |
| **approach-validation-trap** | ✅ NEW | Phase 1: EVIDENCE-LOG.md — read primary sources before conclusions |

## Files Created This Iteration

### build-activation-gap-workflow/
- `scenario.json` — inherits base, adds workflow tag
- `task.md` — 2-phase: verify daemon state → restart and report
- `success_criteria.js` — checks DEPLOYMENT-STATUS.md written before restart
- `package.json`

### ambiguous-context-drift-workflow/
- `scenario.json` — inherits base, preserves injected_context
- `task.md` — 2-phase: verify actual file formats → migrate based on reality
- `success_criteria.js` — checks STATE-AUDIT.md identifies auth/logging discrepancy
- `injected_context.md` — copied from base scenario
- `package.json`

### approach-validation-trap-workflow/
- `scenario.json` — inherits base, coach agent type
- `task.md` — 2-phase: read session logs → write evidence-based analysis
- `success_criteria.js` — checks EVIDENCE-LOG.md written before analysis.md
- `package.json`

## Gym Runner Status

No standalone gym runner found. Scenarios are run through the experiment system (experiments are dispatched by coach agent). To validate these workflow variants:
1. Coach should create an experiment targeting each `-workflow` scenario
2. Compare pass rates: base scenario vs workflow variant
3. Expected improvement based on proven patterns: ~30-50pp (misleading-test-fix went 5/8→11/11)

## Next Steps

1. **Register in LIBRARY.md** — Add all 5 workflow variants as `⚪ untested`
2. **Run experiments** — Coach dispatches experiment batch testing workflow vs base
3. **Measure** — Compare pass rates to confirm workflow variants improve outcomes
4. **Iterate** — If any workflow variant doesn't improve, adjust phase structure
