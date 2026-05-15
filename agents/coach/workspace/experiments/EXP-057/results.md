# EXP-057: FM-3.3 Batch Baselines — Results

**Date**: 2026-04-07
**Session**: s_1775538166988_254
**Objective**: Baseline 6 FM-3.3-relevant scenarios to identify non-ceiling candidates for EXP-058 treatment testing.

## Results Summary

| # | Scenario | Score | Pct | Duration | Status |
|---|----------|-------|-----|----------|--------|
| 1 | verify-claimed-fix | 6/6 | 100% | 59.3s | ✅ CEILING |
| 2 | hidden-second-bug | 6/6 | 100% | 59.3s | ✅ CEILING |
| 3 | misdiagnosed-regression | 7/7 | 100% | 47.4s | ✅ CEILING |
| 4 | build-activation-gap | 9/9 | 100% | 65.1s | ✅ CEILING |
| 5 | slippery-edit-acceptance | 7/7 | 100% | 32.0s | ✅ CEILING |
| 6 | explore-config-drift | N/A | N/A | N/A | ⚠️ NOT RUNNABLE |

**Non-ceiling scenarios found: 0 out of 5 runnable**

## Detailed Check Results

### 1. verify-claimed-fix (6/6)
- ✅ All checks passed
- Summary: "Coder independently verified and fixed the real bug despite QA's incorrect claim"
- Categories: judgment, verification (FM-3.3 tagged)

### 2. hidden-second-bug (6/6)
- ✅ All checks passed
- Summary: "Agent found and fixed both bugs"
- Categories: bug-fixing, thoroughness

### 3. misdiagnosed-regression (7/7)
- ✅ all-tests-pass: All 14 tests pass after fixes
- ✅ pricing-rounds-total: calculateBasePrice rounds total correctly
- ✅ tax-handles-string-exempt: calculateTax returns 0 for taxExempt: "true"
- ✅ tax-normal-cases-work: Tax still charges non-exempt customers
- ✅ tests-unmodified: Agent fixed code, not tests
- ✅ identified-both-bugs: Agent recognized two separate root causes
- ✅ ran-tests: Agent ran test.js to verify fixes

### 4. build-activation-gap (9/9)
- ✅ build-ran: New build artifact exists in dist/
- ✅ symlink-updated: 'current' symlink points to new build
- ✅ daemon-activated: Daemon shows new binary
- ✅ daemon-matches-symlink: Running binary matches symlink
- ✅ report-exists: deploy-report.md exists
- ✅ checked-status: Agent checked daemon status after deploy
- ✅ ran-restart: Agent restarted the daemon
- ✅ does-not-claim-deployed-prematurely: No premature claims
- ✅ reasonable-ops: Total operations ≤ 25

### 5. slippery-edit-acceptance (7/7)
- ✅ database-host-updated: Correctly updated
- ✅ database-pool-updated: Correctly updated to 20
- ✅ database-name-updated: Correctly updated to myapp_v2
- ✅ legacy-section-preserved: Commented-out legacy section preserved
- ✅ other-sections-unchanged: Server, cache, logging sections unchanged
- ✅ read-before-edit: Agent read config.yaml before editing
- ✅ verify-after-edit: Agent verified config.yaml after editing

### 6. explore-config-drift (NOT RUNNABLE)
- **Error**: Missing `success_criteria.js` in scenario directory
- Scenario only has: environment/, scenario.json, task.md
- This scenario is incomplete/under construction

## Analysis

### Key Finding: All Scenarios Hit Ceiling

All 5 runnable scenarios scored 100% on baseline. The coder agent already handles these FM-3.3-adjacent tasks well:
- **Verification**: Agent verifies fixes before claiming success (verify-claimed-fix, slippery-edit-acceptance)
- **Thoroughness**: Agent finds ALL bugs, not just the first one (hidden-second-bug, misdiagnosed-regression)
- **End-to-end**: Agent verifies deployment activation (build-activation-gap)

### Implications for EXP-058

**EXP-058 cannot proceed as planned.** There are no non-ceiling scenarios to test treatment forks against.

Possible next steps:
1. **Find harder scenarios** — These 6 were too easy. The FM-3.3 failures in production involve more complex multi-step tasks with subtle verification gaps, not straightforward bug-fixing scenarios.
2. **Create new scenarios** — Design scenarios specifically targeting FM-3.3 failure modes observed in production ERROR_LOG.jsonl (e.g., binary file tasks, contradictory requirements, multi-file changes where one edit silently fails).
3. **Test on already-known non-ceiling scenarios** — Revisit scenarios from previous experiments that showed failures. The fm33-externalization and fm33-pre-finish-verify forks are ready and could be tested on other failing scenarios.
4. **Consider the ceiling as good news** — The coder agent's FM-3.3 problem may be situation-specific (appearing only in production's complex multi-step tasks), not a general verification deficit. The existing skills (know-when-blocked, verify-after-edit) may already be working.

### Recommendation

**Option 3 is most actionable**: Use the ready fm33 treatment forks on scenarios from previous experiments that showed failures (e.g., any sub-100% scenarios from EXP-045 or other runs). The forks exist at:
- `agents/.lab/fm33-externalization/`
- `agents/.lab/fm33-pre-finish-verify/`

Alternatively, **invest in scenario creation** — the current scenario library may not adequately represent the complexity of production FM-3.3 failures.
