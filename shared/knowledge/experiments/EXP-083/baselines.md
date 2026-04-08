# EXP-083 Phase 1 Baselines: Cross-Reference Generalization

**Date**: 2026-04-08
**Session**: s_1775638193922_20
**Protocol**: 6 baseline runs per scenario, coach agent, no cross-reference intervention

## Scenario A: truncated-env-repair (N=6)

### Check Categories
- **Visible** (6 checks): smtp-port, smtp-secure, smtp-user, smtp-pass, redis-url, rate-limit-max
- **Silent** (2 checks): webhook-url, webhook-secret
- **Preservation** (3 checks): preserved-node-env, preserved-smtp-host, source-not-modified

### Run-by-Run Results

| Run | Overall | Visible (6) | Silent (2) | Preserve (3) | Summary |
|-----|---------|-------------|------------|---------------|---------|
| 1   | FAIL    | 6/6 ✅      | 0/2 ❌     | 3/3 ✅        | Partial fix — visible only |
| 2   | FAIL    | 6/6 ✅      | 0/2 ❌     | 3/3 ✅        | Partial fix — visible only |
| 3   | FAIL    | 6/6 ✅      | 0/2 ❌     | 3/3 ✅        | Partial fix — visible only |
| 4   | FAIL    | 6/6 ✅      | 0/2 ❌     | 3/3 ✅        | Partial fix — visible only |
| 5   | FAIL    | 6/6 ✅      | 0/2 ❌     | 3/3 ✅        | Partial fix — visible only |
| 6   | FAIL    | 6/6 ✅      | 0/2 ❌     | 3/3 ✅        | Partial fix — visible only |

### Summary Statistics
- **Visible pass rate**: 36/36 = **100%** (all visible checks passed every run)
- **Silent pass rate**: 0/12 = **0%** (no silent check ever passed)
- **Preservation pass rate**: 18/18 = **100%**
- **Overall pass rate**: 0/6 = **0%** (core requires all checks)

---

## Scenario B: truncated-schema-migration (N=6)

### Check Categories
- **Visible** (2 checks): has-role, original-columns
- **Silent** (2 checks): has-avatar-url, has-last-login
- **Other** (2 checks): source-not-modified, schema-valid-sql

### Run-by-Run Results

| Run | Overall | Visible (2) | Silent (2) | Other (2) | Summary |
|-----|---------|-------------|------------|-----------|---------|
| 1   | FAIL    | 2/2 ✅      | 0/2 ❌     | 2/2 ✅    | Partial fix — visible only |
| 2   | FAIL    | 2/2 ✅      | 0/2 ❌     | 2/2 ✅    | Partial fix — visible only |
| 3   | FAIL    | 2/2 ✅      | 0/2 ❌     | 2/2 ✅    | Partial fix — visible only |
| 4   | FAIL    | 2/2 ✅      | 0/2 ❌     | 2/2 ✅    | Partial fix — visible only |
| 5   | FAIL    | 2/2 ✅      | 0/2 ❌     | 2/2 ✅    | Partial fix — visible only |
| 6   | FAIL    | 2/2 ✅      | 0/2 ❌     | 2/2 ✅    | Partial fix — visible only |

### Summary Statistics
- **Visible pass rate**: 12/12 = **100%** (all visible checks passed every run)
- **Silent pass rate**: 0/12 = **0%** (no silent check ever passed)
- **Other pass rate**: 12/12 = **100%**
- **Overall pass rate**: 0/6 = **0%**

---

## Combined Baseline Summary

| Metric | Env-Repair | Schema-Migration | Combined |
|--------|-----------|------------------|----------|
| Visible pass rate | 100% (36/36) | 100% (12/12) | 100% (48/48) |
| Silent pass rate | 0% (0/12) | 0% (0/12) | 0% (0/24) |
| Overall pass rate | 0% (0/6) | 0% (0/6) | 0% (0/12) |

## Hypothesis Assessment

**The visible/silent gap hypothesis is strongly confirmed.**

- Agents fix every visible issue (100%) but never discover silent issues (0%) across both domains
- Zero variance in either direction — this is a floor effect for silent checks
- The pattern is identical across .env repair and SQL schema migration, confirming it's a general absent-information problem, not domain-specific
- Agents never spontaneously cross-reference source code when test output provides a clear (but incomplete) fix path

**Baseline establishes a clean floor for Phase 2 treatment measurement:**
- Any silent check passes in treatment runs represent genuine cross-reference skill effect
- The 0% baseline means even 1/12 silent passes would be a measurable signal
- Treatment effect size is maximally detectable (0% floor → any improvement)

## Notes
- All runs used `--agent coach` with identical prompt (hash: 0dd30a7ffcfc)
- Run durations: ~30-45s for env-repair, ~30-40s for schema-migration
- No infrastructure failures — all 12 runs completed successfully
- Preservation/source checks all passed — agents don't break working functionality
