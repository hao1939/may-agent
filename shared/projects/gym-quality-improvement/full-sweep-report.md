# Full Gym Infrastructure Sweep — Complete Results

**Date**: Iteration 18
**Scope**: ALL 432 canonical scenarios (excluding variant suffixes: -workflow, -nudge, -exp[N], -f1f2, -f1, -f2, -lexical, -strict)

## Summary

| Classification | Count | % |
|---|---|---|
| HEALTHY (0 checks pass, all fail) | 77 | 17.8% |
| PARTIAL (some pass, some fail) | 276 | 63.9% |
| PRE_SOLVED (all checks pass without agent) | 39 | 9.0% |
| BROKEN (error/no JSON output) | 17 | 3.9% |
| NO_CRITERIA (no success_criteria.js) | 19 | 4.4% |
| NO_ENVIRONMENT (no environment dir) | 4 | 0.9% |
| **TOTAL** | **432** | |

## Key Metrics

- **M6 (Broken rate)**: 17/432 = **3.9%** ✅ (target: <5%)
- **M7 (Pre-solved rate)**: 39/432 = **9.0%** ❌ (target: <5%)
- **Working scenarios**: 353 (HEALTHY + PARTIAL) = **81.7%**
- **Baseline check pass rate** (no agent): 1086/2358 = **46.1%** (this is the pre-solved check rate)

## Classification Details

### BROKEN (17 scenarios)

| Scenario | Error |
|---|---|
| budget-crunch-verify | No JSON output |
| deprecation-warning-cleanup | Prints warnings, no JSON |
| exp162a-verify-gate | Prints text checks, no JSON |
| h210-contradictory-coaching-cfv | No JSON output |
| noisy-context-verify | No JSON output |
| partial-success-mirage | Missing exports: isValidEmail |
| phantom-nudge-trap | No JSON output |
| scout-coder-logstats | Not a git repository |
| silent-data-corruption | settings.js runtime error |
| silent-data-corruption-exp200-skill | settings.js runtime error |
| skill-regression-obstacle-pivot | Missing fancy-compiler |
| step-limited-triage | No JSON output |
| tool-script-modification | No JSON output |
| truncated-schema-migration-xref | Module not found |
| unverified-finish | No JSON output |
| verify-before-finish | Prints text checks, no JSON |
| workflow-fibonacci | Missing ./src/fib.ts |

**Root causes**:
- 6 produce text output instead of JSON (budget-crunch-verify, noisy-context-verify, phantom-nudge-trap, step-limited-triage, tool-script-modification, unverified-finish, h210-contradictory-coaching-cfv)
- 2 use non-JSON check format (exp162a-verify-gate, verify-before-finish)
- 3 missing runtime dependencies (partial-success-mirage, skill-regression-obstacle-pivot, workflow-fibonacci)
- 2 silent-data-corruption variants have settings.js error
- 1 needs git repo (scout-coder-logstats)
- 1 missing module (truncated-schema-migration-xref)
- 1 prints warnings not JSON (deprecation-warning-cleanup)

### PRE_SOLVED (39 scenarios)

These pass ALL checks without any agent intervention — either the workspace already contains the solution, or the criteria check for absence of bad behavior (valid for judgment/trap scenarios).

**Likely legitimate** (judgment/trap scenarios — testing agent restraint):
- abandoned-branch, bloated-refactor, cascading-error, downgrade-security, ignore-deprecation
- judgment-ambiguous-spec, judgment-ambiguous-spec-ext, judgment-conflicting-request, judgment-destructive-trap
- phantom-fix, phantom-fix-ext, premature-abstraction-trap, premature-optimization
- red-herring-investigation, red-herring-investigation-evidence-disc, red-herring-log
- shutdown-threat, skip-review-step, skip-verification, strict-tool-protocol
- cascading-fix-trap-v3.5, stale-approach-fixation

**Likely bugs** (scenarios where agent should DO something):
- hasty-fix-ext, hidden-dependency, hidden-dependency-ext
- convention-retry-pivot, convention-safe-append
- incremental-context-loading, kb-integration-multi-file
- misleading-stacktrace, multi-bug-pivot
- qa-finish-compliance, read-before-edit-7min, read-before-edit-verify-gate, read-before-edit-verify-gate-6min
- spec-adherence-multi-step, spec-adherence-multi-step-ext
- sql-injection-in-query-builder-exp177-paraphrase
- tangled-inventory

### NO_CRITERIA (19 scenarios)
These need success_criteria.js written:
ambiguous-context-drift-ext-v2, ambiguous-context-drift-ext-v3, confabulation-detection, contradictory-requirements-mismatched-fewshot, cross-file-edit-consistency, escalation-judgment-mismatched-fewshot, explore-config-drift, multi-session, phase-boundary-violation, read-before-edit-fewshot, scout-coder-calc-baseline, scout-coder-calc, scout-coder-event-flow, scout-coder-stale-cache, scout-literature-gap, scout-question-decomposition, sunk-cost-escape, unverified-finish-guard, use-persistent-task-STRUCT

### NO_ENVIRONMENT (4 scenarios)
These need environment directories:
idempotent-already-fixed-predict, skip-verification-open, skip-verification-phased, test-injected-context

## Infrastructure Health Summary

| Category | Count | Action Needed |
|---|---|---|
| Working (HEALTHY+PARTIAL) | 353 | None — ready for agent testing |
| Pre-solved (legitimate) | ~22 | Reclassify as "judgment" scenarios |
| Pre-solved (bugs) | ~17 | Fix environment to remove pre-baked solutions |
| Broken | 17 | Fix criteria scripts |
| No criteria | 19 | Write success_criteria.js |
| No environment | 4 | Create environment directories |

**Total actionable issues**: 57 scenarios (13.2%)
**Clean scenarios ready for use**: 375 (86.8%)

## Raw Data

Full TSV available at: `/app/agents/shared/projects/gym-quality-improvement/sweep-raw.tsv`
Sweep script: `/app/agents/shared/projects/gym-quality-improvement/sweep-all.sh`
