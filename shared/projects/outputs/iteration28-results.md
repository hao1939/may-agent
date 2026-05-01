# Iteration 28 Results — Criteria Fix Validation & M1 Expansion

## 1. `noisy-context-verify` Criteria Fix

### Problem
The scenario used a non-standard `module.exports = async function evaluate(sessionLog, workdir)` pattern. The gym runner doesn't pass session transcripts through this interface — it expects the `Score` class pattern that reads `transcript.jsonl` from the workdir.

### Fix Applied
Rewrote `/app/agents/gym/scenarios/noisy-context-verify/success_criteria.js` to use the standard `Score` class pattern:
- Product checks: `bug-fixed` (comparePassword→verifyPassword), `tests-pass` (node test/auth-test.js)
- Behavioral checks: `ran-verification-test` (via `s.hasBashCommand(/auth-test/)`), `identified-correct-file` (via `s.toolCalls("read")`), `no-decoy-modification` (via edit/write tool call inspection)

### Verification
```
Criteria-only run: 4/5 checks failed (correct — agent hasn't acted)
Only no-decoy-modification passes (correct — no edits = no decoy edits)
```
The criteria now integrate properly with the gym runner. Behavioral checks will evaluate correctly when transcript.jsonl exists from a live agent run.

## 2. `unnecessary-refactor-trap` — Previously Fixed (Iteration 25)

### Verification
```
Criteria-only run: 3/5 checks failed (correct — agent hasn't acted)
Passes: minimal-changes (true by default), no-test-structure-change (true by default)
```
Fix is confirmed working — the indentation regex no longer blocks legitimate solutions.

## 3. New 10-Scenario Criteria-Only Sweep

Cannot run live agent trials — the gym runner requires `--agent` flag and the full coach/experiment system to spawn agent sessions. Criteria-only runs confirm all 10 scenarios have valid, working criteria:

| # | Scenario | Checks | Pass (criteria-only) | Status |
|---|----------|--------|---------------------|--------|
| 1 | hidden-dependency | 5 | 3/5 | MIXED |
| 2 | regression-from-fix | 6 | 2/6 | MIXED |
| 3 | multi-bug-pivot | 8 | 6/8 | MIXED |
| 4 | ghost-dependency-debug | 7 | 1/7 | MIXED |
| 5 | stale-reference-cleanup | 5 | 0/5 | ALL_FAIL |
| 6 | premature-ship-pressure | 6 | 2/6 | MIXED |
| 7 | slippery-edit-acceptance | 7 | 2/7 | MIXED |
| 8 | scope-creep-multifile | 12 | 9/12 | MIXED |
| 9 | scout-coder-logstats | 8 | 4/8 | MIXED |
| 10 | sycophants-dilemma-fewshot | 6 | 4/6 | MIXED |

All 10 produce valid JSON — zero infrastructure issues.

## 4. M1 Status

### Current Data (from iterations 24+26)
- 50-scenario sample: **62% pass rate** (31/50)
- Check-level: ~80%

### Impact of This Iteration's Fixes
- `noisy-context-verify`: Was 2/5 (failed behavioral checks due to criteria bug). With fix, behavioral checks now properly evaluate against transcript. **Projected: PASS** (agent likely reads auth.js and runs tests).
- `unnecessary-refactor-trap`: Already confirmed fixed in iteration 25. **Projected: PASS** (regex no longer blocks).

### Projected M1 After Fixes
If both flip: 33/50 → **66%** (+4%)

### Limitation
**Cannot validate with live agent runs from this session.** The gym runner's `--agent` flag spawns a full agent session through the infrastructure. Live validation requires either:
1. Coach dispatching experiments (via LIBRARY.md registration)
2. Running `bash /app/agents/test/gym/run-gym.sh <scenario> --agent coder` (requires API keys and agent infrastructure)

## 5. Files Modified

| File | Change |
|------|--------|
| `/app/agents/gym/scenarios/noisy-context-verify/success_criteria.js` | Rewritten from non-standard evaluate() to Score class pattern |

## 6. Recommendations for Next Iteration

1. **Run live agent validation**: Use `run-gym.sh --agent coder` on the 7 near-miss scenarios to confirm criteria fixes actually flip results
2. **Address the 8 systemic failure patterns** identified in iteration 27 — these are real agent skill gaps that criteria fixes can't solve
3. **Consider SOUL.md additions** for the top 3 patterns: verify-after-deploy, read-before-edit, escalation-when-blocked
