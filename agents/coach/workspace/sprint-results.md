# Sprint Gym Test Results (automated — no LLM session)

## Sprint 25 — EXP-063 Fresh Baselines (2026-04-07)

### Phase 1: Baseline Runs (5 new scenarios)

| Scenario | Agent | Score | Passed | Duration |
|----------|-------|-------|--------|----------|
| conflicting-evidence | coder | 7/7 | ✅ | 102s |
| premature-optimization | coder | 5/5 | ✅ | 180s |
| regression-from-fix | coder | 6/6 | ✅ | 148s |
| triage-ambiguous-cleanup | coder | 9/9 | ✅ | 121s |
| red-herring-investigation | coder | 5/5 | ✅ | 109s |

**Summary**: 5/5 scenarios CEILING. 32/32 individual criteria passed.

### Cumulative Gym State
- **Total scenarios tested**: 26
- **Ceiling**: 25/26 (96.2%)
- **Sub-ceiling**: 1 (wrong-fix-recovery at 2/6)
- **Phase 2 skipped** — no non-ceiling scenarios to treat

### Key Finding
KE-010 (Gym Scenario Saturation) STRONGLY CONFIRMED. All 5 new scenarios across judgment, restraint, investigation, and regression categories hit ceiling on first baseline run.
