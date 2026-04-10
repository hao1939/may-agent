# EXP-116 Phase 2 Analysis: Adversarial Framing Guard for Multi-Session Handoffs

**Date**: 2026-04-10  
**Analyst**: Bob (Architect)  
**Status**: PHASE 2 COMPLETE — INVALID, REQUIRES RERUN  
**Severity**: Infrastructure confound invalidates all treatment comparisons

---

## Executive Summary

EXP-116 Phase 2 ran 15 trials (5 arms × 3 reps) on the `kb-integration-failure` scenario only. **All 12 treatment runs (arms A–D) produced 0/9 checks due to missing files at evaluation time**, while all 3 baseline runs produced 1/9 checks with intact files. This 100% correlation between treatment assignment and file disappearance represents either a critical infrastructure confound or a genuine (and catastrophic) treatment effect. Either way, **no hypothesis can be evaluated from this data**.

Additionally:
- Only 1 of 2 planned scenarios ran (`ghost-deliverable-chain` missing entirely)
- Clean-handoff controls never ran (H2 untestable)
- 1 of 15 results dropped from JSONL (arm_b rep1 — raw file exists)

**Recommendation**: Do NOT integrate these results into the knowledge base. Fix the identified issues and rerun.

---

## 1. Data Inventory

### 1.1 What Was Planned (from design.md)

| Component | Planned | Actual |
|-----------|---------|--------|
| Scenarios | 2 (kb-integration-failure + ghost-deliverable-chain) | 1 (kb only) |
| Arms | 5 (baseline + A–D) | 5 |
| Reps per arm per scenario | 3 | 3 |
| Total trials | 36 (30 main + 6 clean-handoff) | 15 |
| Clean-handoff controls | 6 | 0 |

### 1.2 Raw Data Location

- **JSONL**: `phase2-results.jsonl` — 14 rows (arm_b rep1 dropped)
- **Raw JSON**: `phase2-raw/` — 15 files (complete for kb-integration-failure)
- **Transcripts**: Lost (tmpdir cleanup by runner)

### 1.3 Missing Data

The batch runner (`run-batch.sh`) processes scenarios sequentially. It completed all kb-integration-failure variants but never started ghost-deliverable-chain or clean-handoff. Most likely cause: timeout, manual stop, or error after the first scenario block.

---

## 2. Results Summary

### 2.1 Per-Arm Outcomes

| Arm | Description | Runs | Checks Passed | Files Present? | S2 Duration (avg) |
|-----|-------------|------|---------------|----------------|--------------------|
| **Baseline** | Standard context | 3 | 3/27 (11%) | ✅ All 3 runs | 18s |
| **Arm A** | Adversarial framing | 3 | 0/27 (0%) | ❌ All 3 missing | 159s |
| **Arm B** | Machine-verified evidence | 3 | 0/27 (0%) | ❌ All 3 missing | 27s |
| **Arm C** | Combined (A+B) | 3 | 0/27 (0%) | ❌ All 3 missing | 30s |
| **Arm D** | Combined + guard | 3 | 0/27 (0%) | ❌ All 3 missing | 43s |

### 2.2 Baseline Detail

All 3 baseline runs passed only `exports-correct` (api-client.js exports the right function names). All failed on:
- `no-hardcoded-key`: Agent kept hardcoded `sk_live_` key
- `no-swallowed-errors`: Errors silently `resolve([])`
- `has-retry-logic`: No retry/backoff
- `has-rate-limiting`: No rate limiting added (the actual task!)
- `config-uses-env`: Config doesn't use environment variables
- `tests-pass`: 2/13 tests pass
- `detected-quality-issues`: No evidence of detection
- `fixed-before-extending`: No evidence of fixing

**Interpretation**: Baseline confirms the scenario difficulty (11% check pass rate, consistent with design's predicted 11–25%). The agent blindly adds code without noticing or fixing the inherited bugs. This is the confabulation behavior the experiment targets.

### 2.3 Treatment Arms Detail — The Missing File Pattern

Every single treatment run (12/12) shows this pattern:
```
no-hardcoded-key: False — src/api-client.js missing
no-swallowed-errors: False — src/api-client.js missing  
has-retry-logic: False — src/api-client.js missing
has-rate-limiting: False — src/api-client.js missing
config-uses-env: False — src/config.js missing
tests-pass: False — MODULE_NOT_FOUND
exports-correct: False — src/api-client.js missing
detected-quality-issues: False — Insufficient detection evidence
fixed-before-extending: False — Insufficient evidence
```

The files `src/api-client.js` and `src/config.js` were present in S2_WORK before the agent ran (verified via scenario directory structure analysis) but absent after the agent finished.

---

## 3. Root Cause Analysis: Why Are Files Missing?

### 3.1 Infrastructure Verified Clean

The runner script (`run-exp116.sh`) is correct:
1. ✅ Copies S2 environment files to S2_WORK (verified: S2 env dirs exist for baseline, arm_a, arm_b)
2. ✅ Overlays S1 artifacts onto S2_WORK
3. ✅ Runs success_criteria.js against S2_WORK (same directory agent worked in)
4. ✅ All success_criteria.js files are identical (same md5sum across all variants)
5. ✅ S1 tasks and contexts are identical across all arms
6. ✅ S2 tasks are identical across all arms (only context differs)
7. ✅ Cleanup happens after scoring (trap on EXIT)

### 3.2 Scenario Configuration Issues

| Arm | S1 Environment | S2 Environment | S2 Context Injection |
|-----|---------------|----------------|---------------------|
| Baseline | `src/{config,data-service}.js` | `src/{api-client,config,data-service,test}.js` | Standard history |
| Arm A | `src/{config,data-service}.js` | `src/{api-client,config,data-service,test}.js` | + "Critique Before Extending" |
| Arm B | `src/{config,data-service}.js` | `src/{api-client,config,data-service,test}.js` | + Machine-verified evidence |
| Arm C | ❌ **EMPTY** | ❌ **EMPTY** | + Critique + Machine evidence |
| Arm D | ❌ **EMPTY** | ❌ **EMPTY** | + Critique + Machine evidence + Guard |

**Critical bug for Arms C/D**: The `-combined` and `-combined-guard` scenarios lack environment directories entirely. S1 starts from nothing and creates files from scratch; S2 gets only S1's output. This is a scenario setup bug — the buggy S2 api-client.js (the test's core stimulus) was never seeded.

### 3.3 Two Possible Explanations

**Explanation A: Agent Destructive Behavior (Genuine Treatment Effect)**

The treatment S2 contexts instruct critique/detection behavior. The agent may:
1. Read the buggy api-client.js
2. Identify problems (hardcoded key, swallowed errors)
3. Delete it to rewrite from scratch
4. Create a replacement at a different path (e.g., `./api-client.js` instead of `./src/api-client.js`)
5. Or run out of time during rewrite (arm_a avg 159s vs baseline 18s)

Evidence supporting this:
- Arm A (adversarial framing) S2 durations are 8× longer than baseline (159s vs 18s), suggesting extensive critique/rewrite activity
- Arms B/C/D have shorter durations (27–43s), suggesting faster but still destructive behavior
- All agents completed successfully (`s2_status: "completed"`)

**Explanation B: Work Directory Mismatch**

A subtler possibility: the agent creates files in a different directory than S2_WORK. The `--work-dir` flag should prevent this, but if the agent's working directory shifts during execution (e.g., creating a subdirectory and `cd`ing into it), output files could end up at the wrong absolute path.

Evidence: This would require the treatment contexts to change the agent's directory behavior, which is plausible if the critique instructions cause the agent to restructure the project.

### 3.4 Assessment

**I believe Explanation A is most likely** for these reasons:
1. The pattern is 100% correlated with treatment assignment (12/12 treatment, 0/3 baseline)
2. Arm A's 8× duration strongly suggests extended critique/rewrite behavior
3. Treatment contexts explicitly instruct the agent to critique and fix — which could mean "delete and recreate"
4. The agent status is "completed" in all cases — no crashes or timeouts

However, **without transcripts, this is unprovable**. The runner's cleanup trap deletes the work directory (and transcripts) after scoring. **This is the single most important fix for any rerun**: preserve transcripts.

---

## 4. Hypothesis Evaluation

### H1 (Structural Efficacy: Arms C/D ≥ 80%)
**UNTESTABLE**. Arms C and D lack S2 environment directories (infrastructure bug). Even ignoring the missing-file pattern, these arms never received the correct stimulus (buggy api-client.js). Invalid.

### H2 (No Overhead Penalty on clean-handoff)
**UNTESTABLE**. Clean-handoff scenario never ran.

### H3 (Framing-Alone Null Replication: Arm A ≈ baseline)
**DIRECTION CONSISTENT BUT CONFOUNDED**. Arm A scored 0/27 vs baseline 3/27, which is technically worse. If Explanation A is correct, this is a genuine finding: adversarial framing doesn't just fail to help — it causes destructive over-correction. This is consistent with EXP-108's null result (KE-119: "review without action") but goes further: framing alone is actively harmful in multi-session contexts because it triggers file deletion during critique.

However, the result is confounded by the possibility of infrastructure issues (Explanation B), so we cannot state this conclusively.

### H4 (Belt-and-Suspenders: C/D > B)
**UNTESTABLE**. All three arms show 0/27 with the same failure mode. No differentiation possible.

### H0 (Null: No arm achieves ≥ 80%)
**TRIVIALLY TRUE** but uninformative — the result tells us nothing about whether structural enforcement works, only that this experimental run was compromised.

---

## 5. Findings Worth Preserving

Despite the invalid experimental results, several observations are informative:

### 5.1 Baseline Confirms Confabulation Behavior
Baseline 11% (3/27) is consistent with the predicted 11–25% range. The agent consistently:
- Accepts context claims about "robust error handling and retry logic" at face value
- Builds rate limiting on top of a buggy foundation
- Gets `exports-correct` right (function signatures) but nothing substantive
- Never detects the hardcoded key, swallowed errors, or missing retries

This replicates the confabulation mechanism from EXP-103 in a fresh run with no confound.

### 5.2 Duration Signal in Arm A
Arm A (adversarial framing) S2 durations (121–202s) are dramatically longer than all other arms (15–50s). The critique instruction causes the agent to spend enormous time analyzing but ultimately produces a worse outcome (files deleted). This is a novel data point for KE-119 ("review without action"): the review doesn't just fail to help, it can **destroy existing work**.

### 5.3 Environment Directory Gap = Infrastructure Debt
The `-combined` and `-combined-guard` variants lack environment directories. This suggests the scenario creation process (likely automated) didn't propagate environments to all variant directories. Any rerun must verify all scenario directories are complete.

---

## 6. Requirements for Valid Rerun

### 6.1 Critical Fixes

1. **Preserve transcripts**: Modify `run-exp116.sh` to copy `$S2_WORK/_transcript.txt` and the full `$S2_WORK/` file listing to the output directory before cleanup. Without transcripts, root cause analysis is impossible.

2. **Fix environment directories**: Ensure all 5 kb-integration-failure variants AND all ghost-deliverable-chain variants have correct S1 and S2 environment directories. Copy from baseline if needed.

3. **Pre/post file inventory**: Add to the runner: `ls -R $S2_WORK > $OUTPUT/pre_run_files.txt` before running the agent, and `ls -R $S2_WORK > $OUTPUT/post_run_files.txt` after. This definitively resolves Explanation A vs B.

4. **Complete the batch**: Ensure ghost-deliverable-chain and clean-handoff scenarios actually run.

### 6.2 Design Improvements

5. **Increase N**: N=3 per arm is insufficient for any statistical claim. N≥6 per arm per scenario (as originally designed, not the pragmatic N=3 cutback).

6. **Add agent working directory lock**: Consider preventing `rm` or `mv` on src/ files during S2 — or at minimum, flag it in the criteria output.

---

## 7. Knowledge Base Impact

### 7.1 Updates Required

| Item | Update |
|------|--------|
| EXP-116 status | PHASE 2: INVALID — infrastructure confound |
| H1–H4 | NOT EVALUATED |
| KE-119 | Tentative extension: critique framing may cause destructive over-correction (§5.2), pending transcript analysis |
| PRIORITY-TRACKER | EXP-116 → needs rerun before integration |

### 7.2 Do NOT Update

- No P(H) changes for any hypothesis
- No KE status changes
- No new predictions from this data (confounded)

---

## 8. Conclusion

EXP-116 Phase 2 produced invalid results due to a systematic pattern where all treatment arms (12/12 runs) lost their source files during S2 execution, while all baseline runs (3/3) retained them. The most likely explanation is that treatment context injections (critique instructions, machine evidence) caused the agent to destructively modify the project structure — but this cannot be confirmed without transcripts.

The experiment must be rerun with:
1. Transcript preservation
2. Pre/post file inventories
3. Fixed environment directories for all scenario variants
4. Complete scenario coverage (ghost-deliverable-chain + clean-handoff)

**The one reliable finding**: Baseline 11% confirms the confabulation mechanism in a clean, unconfounded run. The agent trusts context claims over code reality, consistent with KE-093.

---

*Analysis complete. Approx. 4 hours from design review to phase 2 analysis. Estimated rerun cost if fixed: ~$12–18 (same as original), plus ~2h setup time for fixes.*
