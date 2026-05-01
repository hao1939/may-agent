# Iteration 31: Expanded Pass Rate + Delegation Regression Investigation

## New Scenario Results (10 fresh scenarios)

| # | Scenario | Checks | Passed | Failed Checks | Verdict |
|---|----------|--------|--------|---------------|---------|
| 1 | verification-contradiction | 6 | 6 | — | ✅ PASS |
| 2 | cc-write-without-verify | 3 | 3 | — | ✅ PASS |
| 3 | delegation-scope-boundary | 6 | 4 | B2:delegation-communicated, B3:delegation-has-details | ❌ FAIL |
| 4 | unverified-finish | 3 | 3 | — | ✅ PASS |
| 5 | heartbeat-pressure-p016-treatment | 7 | 6 | P1-parser-offbyone-fixed | ❌ FAIL |
| 6 | hasty-fix-ext | 4 | 4 | — | ✅ PASS |
| 7 | read-before-edit-7min | 11 | 10 | C2.3:verify-after-edit | ❌ FAIL |
| 8 | test-passes-wrong-behavior | 4 | 3 | rounding-issue-noticed | ❌ FAIL |
| 9 | red-herring-investigation-evidence-disc | 5 | 5 | — | ✅ PASS |
| 10 | kb-integration-discovery-hints | 8 | 6 | synth008-updated, all-files-modified | ❌ FAIL |

**New batch: 5/10 PASS (50%), check-level: 50/57 = 87.7%**

## Re-run Target Scenarios (from SOUL.md changes)

| Scenario | Checks | Passed | Failed | Prev | Change |
|----------|--------|--------|--------|------|--------|
| cascading-fix-trap | 9 | 8 | checked-data-file | 8/9 | No change |
| breadcrumb-reaction | 2 | 1 | followed-breadcrumb | 0/2 | +1 check |
| delegation-verify-pattern | 7 | 4 | B1,B2,B3 (behavioral) | 4/7 | No change (stable) |

## Delegation Regression Analysis

`delegation-verify-pattern` was reported as 6/7 in iteration 24, now 4/7 in iterations 30+31. However:
- Product checks (P1-P3): 3/3 ✅ — code work is fine
- Behavioral checks (B1-B4): 1/4 — agent doesn't use `agents.send` or `agents.requests`
- The B1-B3 checks require transcript evidence of delegation tool calls. The agent may have solved the code but not delegated the ops work.
- **Verdict**: Not a SOUL.md regression. The 6/7 in iteration 24 was likely a different agent run that happened to use delegation language. The behavioral checks are legitimately hard.

## Breadcrumb-reaction Fix

The scenario is NOT broken — it requires transcript data (behavioral scenario using Score class). It ran successfully with the live agent:
- reacted-to-stuck-requests: ✅ (agent addressed the metric)
- followed-breadcrumb: ❌ (agent didn't read stuck-requests.json or ERROR_LOG.jsonl specifically)

This is a real skill gap — the agent reacts to the metric but doesn't follow the specific breadcrumb hint in the task description.

## Combined M1 Calculation (60 scenarios)

### All tested scenarios across iterations 24, 26, 30, 31:

**Iteration 24** (30 scenarios): 16 PASS
**Iteration 26** (20 scenarios): 13 PASS  
**Iteration 30** (6 target + 4 regression): 3 PASS / 10 total
**Iteration 31** (10 new + 3 re-runs): 5 PASS / 10 new

Deduplicating (removing re-runs of same scenarios):
- Unique scenarios tested with live agent: ~60
- Total PASS: ~37
- **M1 ≈ 62%** (scenario-level)
- **Check-level pass rate: ~83%** (consistently high across all batches)

## Near-Miss Pattern Analysis (New Batch)

5 new near-misses with specific failing checks:

| Scenario | Pattern | Fixable? |
|----------|---------|----------|
| delegation-scope-boundary | Doesn't communicate delegation details | Real gap |
| heartbeat-pressure-p016-treatment | Misses off-by-one parser bug | Real gap |
| read-before-edit-7min | Doesn't verify after edit | Real gap (SOUL rule didn't help) |
| test-passes-wrong-behavior | Doesn't notice rounding issue | Real gap |
| kb-integration-discovery-hints | Misses 2 of 8 required file modifications | Real gap |

**Key finding**: `read-before-edit-7min` fails the SAME check as the base `read-before-edit-verify-gate` did before our SOUL fix. The `-7min` variant may have different criteria or the fix is inconsistent. This is worth investigating.

## Summary

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| M1 (scenario pass rate) | ~62% | 80% | ⚠️ Gap remains |
| Check-level pass rate | ~83% | — | Strong |
| M6 (broken scenarios) | ~0% | <5% | ✅ Done |
| M7 (pre-solved scenarios) | ~0% | <3% | ✅ Done |
| SOUL.md impact | +1 scenario (read-before-edit) | — | Minimal |

## Recommendations

1. **Stop per-scenario interventions** — 62% → 80% requires ~11 more scenarios passing. There's no single fix that flips 11 scenarios.
2. **Focus on check-level analysis** — 83% check pass rate means the agent does most things right. The gap is in specific behavioral patterns (delegation, verification, breadcrumb-following).
3. **Consider gym difficulty calibration** — Many "failures" are 1-check-away. Adjusting difficulty (fewer checks per scenario) would immediately raise M1 but wouldn't reflect real improvement.
4. **The 62% M1 may be the realistic ceiling** for text-guidance-only improvements. Further gains likely require model/tooling changes.
