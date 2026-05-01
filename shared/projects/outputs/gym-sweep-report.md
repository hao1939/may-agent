# Gym Full Infrastructure Sweep Report

**Date**: 2026-08-14  
**Scope**: All 492 scenarios in `/app/agents/gym/scenarios/`  
**Method**: Run `success_criteria.js` in each scenario's directory with no agent work (criteria-only)

## Summary

| Status | Count | % | Description |
|--------|-------|---|-------------|
| HEALTHY | 227 | 46% | Criteria run, some/all checks fail (working as intended) |
| PRE_SOLVED | 202 | 41% | All checks pass without agent work (no training signal) |
| BROKEN | 44 | 9% | Criteria crash or produce no parseable output |
| NO_CRITERIA | 19 | 4% | No `success_criteria.js` file |

## Key Findings

### 1. PRE_SOLVED is the biggest problem (202 scenarios, 41%)
- **72 are variants** (workflow/nudge/skill/exp variants) — many inherit pre-solved state from fixed base scenarios
- **130 are base scenarios** — these need investigation. Many may legitimately fail with a real agent workspace but pass in their packaged environment because solutions are pre-baked.
- **Action**: Audit the 130 base pre-solved scenarios. For each, determine if the environment ships with the solution already applied.

### 2. BROKEN: 31 of 44 just need a `<workDir>` argument
These criteria scripts expect `node success_criteria.js <workDir>` but the sweep ran them with no argument. They aren't truly broken — they just have a different CLI interface.
- **Action**: Re-run these 31 with `.` as workDir argument.

### 3. BROKEN: 13 have real errors
- File system errors (`node:fs:1590` — likely hardcoded paths)
- ESM resolve errors (`node:internal/modules/esm/resolve`)
- Empty output (criteria runs but produces nothing)

### 4. NO_CRITERIA: 19 scenarios
- `multi-session` — directory of sub-scenarios (not a bug)
- `confabulation-detection`, `sunk-cost-escape`, etc. — may be stubs or WIP
- Scout scenarios (6) — likely use a different evaluation method

## Broken Scenarios (44)

### Need `<workDir>` argument (31):
```
deprecation-warning-cleanup, enoent-file-search, exp-rec-stale-config-gate,
exp-rec-wrong-error-gate, hidden-second-bug, incomplete-test-coverage,
partial-migration-leftover, silent-data-corruption-exp200-skill,
silent-data-corruption, sql-injection-in-query-builder-exp177-lexical,
sql-injection-in-query-builder-exp177-paraphrase, sql-injection-in-query-builder-f1,
sql-injection-in-query-builder, stale-config-gate, stale-import-detection,
subtle-off-by-one, test-gap-discovery, truncated-schema-migration-workflow,
truncated-schema-migration, type-error-quick-fix, unverified-finish,
wrong-error-gate, wrong-tool-args, + 8 more
```

### Real crashes (13):
```
budget-crunch-verify, h210-contradictory-coaching-cfv, noisy-context-verify,
phantom-nudge-trap, qa-overstrict-gate-workflow, qa-severity-calibration-workflow,
regression-from-fix-workflow, scope-creep-multifile, scope-creep-resistance-workflow,
+ 4 more
```

## Recommendations

1. **Fix the 31 workDir scripts** — update sweep script to pass `.` as argument, or add CLI wrapper to each
2. **Fix the 13 real crashes** — mostly hardcoded paths or missing dependencies  
3. **Audit 130 base pre-solved scenarios** — highest leverage. If even half are genuinely pre-solved, that's 65 scenarios providing zero training signal
4. **Delete/archive NO_CRITERIA stubs** that will never have criteria

## Raw Data
Full TSV report: `gym-sweep-report.tsv` (same directory)
