# Iteration 20: Batch Fix Results

## Key Finding: The 17 "Broken" Scenarios Are NOT Actually Broken

After running all 17 scenarios individually, **every single one produces valid JSON output with checks**. The sweep script misclassified them because:

1. **Mixed stdout**: Many scenarios print test output (e.g., `✗ total value length is 13`) before the JSON. The sweep script's JSON parser choked on non-JSON prefixes.
2. **workDir argument**: 3 scenarios (`silent-data-corruption`, `silent-data-corruption-exp200-skill`, `deprecation-warning-cleanup`) require `node success_criteria.js <workDir>` but the sweep ran them without arguments.
3. **stderr noise**: Some print warnings to stderr that got mixed into stdout capture.

## Verification Results

| Scenario | Status | Notes |
|----------|--------|-------|
| budget-crunch-verify | ✅ OK | Valid JSON, no issues |
| noisy-context-verify | ✅ OK | Valid JSON, no issues |
| phantom-nudge-trap | ✅ OK | Valid JSON, no issues |
| step-limited-triage | ✅ OK | Valid JSON, no issues |
| tool-script-modification | ✅ OK | Valid JSON, no issues |
| unverified-finish | ✅ OK | Valid JSON, no issues |
| h210-contradictory-coaching-cfv | ✅ OK | Valid JSON, no issues |
| exp162a-verify-gate | ✅ OK | Test output before JSON; JSON valid |
| verify-before-finish | ✅ OK | Test output before JSON; JSON valid |
| partial-success-mirage | ✅ OK | Warning text before JSON; JSON valid |
| skill-regression-obstacle-pivot | ✅ OK | Error text before JSON; JSON valid |
| workflow-fibonacci | ✅ OK | Error text before JSON; JSON valid |
| silent-data-corruption | ✅ OK | Needs `workDir` arg; JSON valid with `.` |
| silent-data-corruption-exp200-skill | ✅ OK | Needs `workDir` arg; JSON valid with `.` |
| scout-coder-logstats | ✅ FIXED | Needed `git init` in environment/; now works |
| truncated-schema-migration-xref | ✅ OK | JSON valid |
| deprecation-warning-cleanup | ✅ OK | Needs `workDir` arg; deprecation warnings on stderr; JSON valid |

## Actual Fix Applied

Only **1 real fix** was needed:
- **scout-coder-logstats**: Ran `git init && git add -A && git commit -m "initial"` in `environment/` directory. The criteria script calls `git log` which requires a repo.

## Root Cause: Sweep Script Bug

The full-sweep script from iteration 18 needs to:
1. Extract JSON from mixed output (take last line, or grep for `{` prefix)
2. Pass `.` as workDir argument to all criteria scripts
3. Separate stderr from stdout

## Updated Metrics

- **M6 (broken scenarios)**: Was reported as 4% (17/432). Actual: **~0.2% (1/432)** — only scout-coder-logstats was genuinely broken.
- **M7 (pre-solved)**: 10% (43/432) — this is real and unchanged.
- The infrastructure is much healthier than we thought.

## Implication

The remaining work is:
1. Fix the sweep script to correctly classify scenarios
2. Continue fixing the 43 pre-solved scenarios (real issue)
3. Focus on agent pass rate improvement (M1)
