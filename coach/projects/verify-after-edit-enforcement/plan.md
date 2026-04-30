# Project: verify-after-edit-enforcement

**Status**: closed
**Close Reason**: EXP-280 NEGATIVE — text skill adds no value beyond existing finish guard. True compliance already 97% when counting bash verification. Closed 2026-08-01.
**Owner**: coach
**Created**: 2028-07-27
**Origin**: Assigned from experiment-vaw-guard-effectiveness results

## Background

The VAW guard experiment (closed 2026-07-02) found 30.8% compliance with verify-after-write. Decision was to narrow scope to edits only. A follow-up project was requested to enforce verify-after-edit.

**However**, EXP-275 (finished 2028-07-27) discovered that when counting bash-based verification (cat, grep, test runs), the true verify-after-edit compliance is **~97%**. The prior 22-30% measurements only counted explicit `read()` calls.

## Assessment

The problem this project was designed to solve is already solved:
- True unverified-edit rate: ~3% (4/137 sessions)
- Agents verify via bash in 95% of cases where read() isn't used
- A finish gate would have 95% false positive rate using read-only heuristic

## Recommendation

**Close this project as already-solved.** The 3% residual is below cost-effective enforcement threshold.

## Milestones (if proceeding)

1. ✅ M1: Measure true violation rate — DONE (EXP-275: 2.9%)
2. M2: Determine if 3% residual causes real quality issues (sample the 4 sessions)
3. M3: Decision — close or build narrow enforcement

## Next Action

~~Review the 4 unverified sessions from EXP-275 to determine if they caused actual bugs. If not, close project.~~

## Decision (2026-04-30)

**REVISED.** EXP-275 showed 97% compliance counting bash verification, but EXP-280 tests whether forcing explicit read() after every edit improves quality scores. Treatment deployed to bob. Measuring until 2026-05-02.

**Status**: closed (EXP-280 NEGATIVE — see top of file)
**Baseline collected**: See `agents/coach/workspace/EXP-280-baseline-data.md` — bob mean quality 0.66 (n=29)
**Closed**: 2026-04-30 — project was already closed per header. Stale notification dismissed.
