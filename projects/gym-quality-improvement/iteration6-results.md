# Iteration 6 Results: Validation Pipeline & Bug Fixes

## Critical Bug Fixed

**All 5 workflow variant scenarios had broken `success_criteria.js`** — 2 of them (`silent-data-corruption-workflow` and `truncated-schema-migration-workflow`) used `s.checkProcess()` which doesn't exist in the gym scoring API. The correct method is `s.checkProduct()`.

### Fix Applied
- `silent-data-corruption-workflow/success_criteria.js`: 3x `checkProcess` → `checkProduct`
- `truncated-schema-migration-workflow/success_criteria.js`: 3x `checkProcess` → `checkProduct`

### Verification
All 5 scenarios now run without API errors in the gym runner:
- `silent-data-corruption-workflow`: ✅ runs (fails on criteria as expected with no agent work)
- `truncated-schema-migration-workflow`: ✅ runs (fails on criteria as expected)
- `build-activation-gap-workflow`: ✅ runs (was already correct)
- `ambiguous-context-drift-workflow`: ✅ runs (was already correct)
- `approach-validation-trap-workflow`: ✅ runs (was already correct)

## LIBRARY.md Updated

Registered 5 new workflow skills as `⚪ untested (workflow)`:
1. `backward-compatibility-check` → silent-data-corruption-workflow
2. `absent-information-discovery` → truncated-schema-migration-workflow
3. `deploy-verify-declare` → build-activation-gap-workflow
4. `context-verification` → ambiguous-context-drift-workflow
5. `evidence-first-analysis` → approach-validation-trap-workflow

## Gym Runner Discovery

The gym runner is at `/app/agents/test/gym/run-gym.sh`. Usage:
```bash
bash agents/test/gym/run-gym.sh <scenario-name> [--timeout <min>]
```

To run a full validation batch (like EXP-248 pattern):
```bash
for scenario in silent-data-corruption-workflow truncated-schema-migration-workflow build-activation-gap-workflow ambiguous-context-drift-workflow approach-validation-trap-workflow; do
  for i in 1 2 3; do
    bash agents/test/gym/run-gym.sh $scenario --timeout 10
  done
done
```

## Experiment Proposal: EXP-360

**Type**: gym-scenario-workflow  
**Method**: workflow-enforcement  
**Scenarios**: 5 workflow variants (listed above)  
**Arms**: 
- A (baseline): Original 5 failing scenarios, 3 runs each
- B (treatment): Workflow variants, 3 runs each  
**N**: 30 total trials (5 scenarios × 2 arms × 3 runs)  
**Target**: ≥60% pass rate on workflow variants (vs 0% baseline on originals)

## Status

- ✅ Bug in success_criteria.js fixed (2 scenarios)
- ✅ All 5 scenarios validated as runnable
- ✅ 5 skills registered in LIBRARY.md
- ⏳ Actual experiment runs need coach to dispatch (or manual batch run)

## Next Steps

1. **Run the experiment batch** — either coach dispatches EXP-360 or someone runs the bash loop above
2. **Measure results** — compare workflow variant pass rates vs baseline 0%
3. **If workflow variants pass**: Mark skills as ✅ proven, propose deployment
4. **If workflow variants fail**: Analyze why — is the workflow phase insufficient? Does the scenario need adjustment?
