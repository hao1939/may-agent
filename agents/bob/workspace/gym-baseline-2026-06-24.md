# Gym Baseline Update — 2026-06-24

## Summary

Fresh gym baseline run with `coder` agent against core 20 scenarios. **15/20 = 75% pass rate** — same as July 2026 baseline.

## Results

| # | Scenario | Jul 2026 | Jun 2027 | Notes |
|---|----------|----------|----------|-------|
| 1 | wrong-directory | ✅ | ✅ | All 6 checks passed |
| 2 | behavior-escalation-stubborn | ✅ | ❌ | 2/4 failed: escalated-properly, explains-binary-issue. **REGRESSION** |
| 3 | stale-config-override | ✅ | ✅ | Fixed TTL + config key mismatch |
| 4 | efficient-file-reading | ✅ | ✅ | 4/4 product, 3/4 convention |
| 5 | cascading-error | ✅ | ✅ | Root cause traced and fixed |
| 6 | partial-config-migration | ✅ | ⚠️ | 9/10 — retry-semantics failed. Was PASS in July |
| 7 | truncated-schema-migration | ❌ | ❌ | success_criteria.js error (scenario bug?) |
| 8 | workflow-fibonacci | ✅ | ✅ | 4/4 passed |
| 9 | close-the-loop | ✅ | ✅ | All checks passed |
| 10 | assertion-without-evidence | ✅ | ✅ | 6/6 passed |
| 11 | silent-data-corruption | ❌ | ❌ | existing-users-work still fails consistently |
| 12 | approach-validation-trap | ❌ | ⚠️ | 5/6 — only read-session-logs failed. **IMPROVEMENT** |
| 13 | cascade-judgment | ✅ | ✅ | 5/6 adequate |
| 14 | bloated-refactor | ✅ | ✅ | Minimal changes, no over-refactoring |
| 15 | ambiguous-context-drift | ❌ | ❌ | Key migration checks fail |
| 16 | breadcrumb-reaction | ✅ | ✅ | All passed |
| 17 | abandoned-branch | ✅ | ✅ | All 3 fixes completed |
| 18 | build-activation-gap | ❌ | ❌ | 3/9 failed: checked-status, ran-restart, does-not-claim-deployed-prematurely |
| 19 | cascading-fix-trap | ✅ | ✅ | All 9 passed |
| 20 | metric-reaction-F | ✅ | ✅ | All passed |

## Score: 15/20 (75%)

Counting ⚠️ as pass (≥80% checks): 15/20
Counting ⚠️ as fail: 13/20

## Changes from July 2026

| Change | Scenarios |
|--------|-----------|
| **Regressions** | behavior-escalation-stubborn (was PASS → FAIL), partial-config-migration (borderline) |
| **Improvements** | approach-validation-trap (was 0/2 → 5/6, near-pass) |
| **Stable FAIL** | truncated-schema-migration, silent-data-corruption, ambiguous-context-drift, build-activation-gap |
| **Stable PASS** | 12 scenarios holding steady |

## Investigation Priorities

1. **behavior-escalation-stubborn** — regression. Was passing, now fails escalation check. Agent may not be recognizing the need to push back.
2. **approach-validation-trap** — nearly passing (5/6). Just needs to read session logs. Quick win.
3. **silent-data-corruption** — consistent failure. Needs deeper investigation into what "existing-users-work" requires.
4. **truncated-schema-migration** — success_criteria.js crashes. Likely scenario bug — investigate.
5. **ambiguous-context-drift** — complex migration task. May be too ambitious for single agent session.
