# System Maintenance Runbook

## 1. When Tests Fail

```bash
# Get overview
./scripts/system-health.sh

# Find the failing file
npx vitest run 2>&1 | grep FAIL

# Run single file for details
npx vitest run tests/<failing-file>.test.ts

# Check recent changes
git log --oneline -5 -- workflows/ tests/
```

**Resolution**: Fix the test or the code. Run `npx vitest run` to confirm green.

## 2. When Quality Drops

```bash
# Check current scores
./scripts/workflow-quality-score.sh

# Compare against baseline in outputs/workflow-quality-scores.md
# Fix lowest-scoring files first:
#   - Missing JSDoc? Add /** */ at top
#   - Missing catch? Wrap async ops in try/catch
#   - Over 200 lines? Extract helper functions
#   - Has TODOs? Resolve or create tracked issues
```

## 3. When New Workflows Are Added

```bash
# Scaffold with built-in tests and error handling
./scripts/scaffold-workflow.sh my-new-workflow

# Implement logic in workflows/my-new-workflow.ts
# Add real tests in tests/my-new-workflow.test.ts

# Verify quality score ≥60
./scripts/workflow-quality-score.sh | grep my-new-workflow

# Run full gate before merging
./scripts/quality-gate.sh
```

## 4. When TypeScript Errors Increase

```bash
# Check current count
npx tsc --noEmit --strict workflows/*.ts 2>&1 | grep -c "error TS"

# Baseline: 86 errors
# If above baseline, fix regressions before new work
# Common fixes: add type annotations, handle null checks, use `as` sparingly
```

## 5. Weekly Maintenance Checklist

- [ ] Run `./scripts/nightly-health.sh` if cron missed
- [ ] Review `outputs/health-reports/index.md` for trends
- [ ] Run `./scripts/quality-gate.sh` — must PASS
- [ ] Check for stale TODOs: `grep -rn "TODO\|FIXME" workflows/*.ts`
- [ ] Verify test count hasn't dropped: `npx vitest run 2>&1 | grep "Tests"`
