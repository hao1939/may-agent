# EXP-025: Prospective Validation of Decision Topology (H-041)

**Date**: 2026-04-04
**Author**: Bob (Architect)
**Status**: DESIGNED — Predictions locked. Ready for coach to run.
**Hypothesis**: H-041 (Decision Topology)
**Type**: Prospective prediction study
**Estimated cost**: ~$3-5 (20 scenario pairs × 2 runs each × ~$0.08/run)

## Why This Experiment Matters

H-041's Decision Topology model (the eliminable-decision ratio R) is the foundation of our entire intervention strategy. Every architectural recommendation we make relies on it. But:

1. **EXP-011 (ρ=0.95)** used N=4 data points, classified retrospectively by someone who knew outcomes
2. **EXP-016 (80% accuracy)** had R values assigned AFTER seeing baseline/workflow results
3. **No prospective test has ever been run** — we've never predicted BEFORE seeing outcomes

This experiment addresses the most critical gap in our knowledge base. If R predictions made blind don't predict outcomes, our entire theory chain collapses (and that's important to know).

## Method

### Prospective Blinding Protocol

1. Bob (me) reads ONLY the task.md descriptions and scenario.json metadata
2. Bob classifies each task's decision landscape and predicts R
3. Bob predicts whether workflow will help or hurt (binary)
4. **Predictions are LOCKED in this file before any runs**
5. Coach runs each scenario pair (baseline + workflow) with n=3 per arm
6. Results are compared to predictions

### Important: I have NOT read any prior gym results for these scenarios

I read task descriptions only. I have not seen:
- Any sweep results
- Any prior pass rates
- The workflow variant task.md files (to avoid inferring what the workflow "fixes")

## Scenario Selection

20 scenario pairs selected because:
- They have both baseline and workflow variants in agents/gym/scenarios/
- They were NOT used in EXP-016's analysis (completely fresh)
- They span multiple categories (bug-fixing, QA, judgment, convention, etc.)

## Predictions (LOCKED)

### Decision Classification and R Prediction

| # | Scenario | N_elim | N_ess | N_nav | R | Prediction | Reasoning |
|---|----------|--------|-------|-------|---|------------|-----------|
| 1 | abandoned-branch | 2 | 3 | 1 | 0.33 | NEUTRAL | Fix bugs = mostly essential (which bug, how to fix). Some eliminable (run tests, check all pass). But debugging IS the work. |
| 2 | cascading-error | 1 | 3 | 1 | 0.20 | HURTS | Root cause analysis is almost entirely essential judgment. Only eliminable: run the program to verify. Workflow adds friction to a naturally exploratory process. |
| 3 | convention-verify-multi-edit | 4 | 0 | 1 | 0.80 | HELPS | All changes specified exactly (which file, which value, what it should be). This is pure eliminable — the correct answer is given in the task. |
| 4 | delegation-scope-boundary | 2 | 3 | 1 | 0.33 | NEUTRAL/HELPS | The in-scope fix is semi-eliminable (error handling pattern), but the judgment about what's "outside scope" and how to handle it is essential. Workflow might help by forcing scope assessment. |
| 5 | efficient-file-reading | 2 | 1 | 2 | 0.40 | NEUTRAL | Task structure is semi-eliminable (grep for degraded, find errors), but the key behavior being tested (efficiency/grep-first) is a process habit — EXP-016 showed workflows don't fix intra-phase habits. |
| 6 | error-recovery-broken-config | 3 | 1 | 0 | 0.75 | HELPS | Fix JSON syntax error + verify = almost entirely eliminable. The config fix is mechanical. |
| 7 | idempotent-already-fixed | 1 | 3 | 2 | 0.17 | HURTS | The test is whether the agent checks if bugs are already fixed before "fixing" them. This is judgment about current state — essential. Workflow adds overhead without eliminating the key judgment. |
| 8 | incremental-context-loading | 1 | 2 | 3 | 0.17 | HURTS | The test is whether the agent uses cached context efficiently rather than re-reading everything. This is a behavioral/efficiency test — workflow can't fix the reading habit. |
| 9 | misleading-stacktrace | 1 | 4 | 1 | 0.17 | HURTS | The scenario deliberately misleads — the real bug isn't where the stacktrace points. Finding the real cause requires essential judgment. Workflow might lock the agent into investigating the wrong thing. |
| 10 | phantom-fix-config | 2 | 3 | 1 | 0.33 | NEUTRAL | Fix failing tests, but the scenario name implies a "phantom" fix trap — agent might think they fixed it when they didn't. Verification is eliminable, but detecting the phantom is essential. |
| 11 | plan-once-amend | 2 | 2 | 2 | 0.33 | NEUTRAL | Heartbeat-style task with multiple items. Tests whether agent sticks to initial plan vs adapts. Both planning and amending are essential. |
| 12 | premature-optimization | 1 | 3 | 2 | 0.17 | HURTS | Performance optimization is almost entirely essential judgment — which bottleneck, what approach. Workflow constrains exploration. |
| 13 | qa-overstrict-gate | 2 | 3 | 1 | 0.33 | NEUTRAL/HURTS | QA review requires judgment about correctness AND about severity. The scenario tests whether agent is overstrict (blocks good changes). That calibration is essential. |
| 14 | qa-severity-calibration | 2 | 3 | 1 | 0.33 | NEUTRAL | Similar to qa-overstrict-gate — tests severity judgment. Mostly essential decisions about what matters. |
| 15 | regression-from-fix | 2 | 3 | 1 | 0.33 | NEUTRAL | Fix a bug, but the scenario name implies the fix itself causes regression. Detecting regression is essential judgment. Running tests is eliminable. |
| 16 | silent-dependency | 2 | 3 | 1 | 0.33 | NEUTRAL | Fix tests, but "silent dependency" implies hidden requirement. Finding it is essential. Running npm install/test is eliminable. |
| 17 | skip-verification | 3 | 1 | 1 | 0.60 | HELPS | "Fix 2 bugs and verify" — the verification step is what's being tested. If the agent skips verification, workflow forces it. This is high-eliminable (fix specified bugs, run tests). |
| 18 | sycophants-dilemma | 1 | 3 | 1 | 0.20 | HURTS (for basic workflow) | We already know from EXP-024 that regular workflow doesn't help here — only strict+materialization gate works. The judgment to resist harmful instructions is essential. |
| 19 | verification-contradiction | 2 | 2 | 1 | 0.40 | NEUTRAL | Fix multiply bug + verify. But "contradiction" implies tests may contradict each other. Resolving contradiction is essential. Running tests is eliminable. |
| 20 | wrong-tool-args | 2 | 2 | 1 | 0.40 | NEUTRAL | Fix the API bug. Semi-structured (error handling pattern). The README-reading requirement adds an eliminable step. |

### Summary of Predictions

| Prediction | Count | Scenarios |
|------------|-------|-----------|
| HELPS (R > 0.5) | 3 | convention-verify-multi-edit, error-recovery-broken-config, skip-verification |
| NEUTRAL (R ≈ 0.3-0.5) | 10 | abandoned-branch, delegation-scope-boundary, efficient-file-reading, phantom-fix-config, plan-once-amend, qa-overstrict-gate, qa-severity-calibration, regression-from-fix, silent-dependency, verification-contradiction, wrong-tool-args |
| HURTS (R < 0.3) | 7 | cascading-error, idempotent-already-fixed, incremental-context-loading, misleading-stacktrace, premature-optimization, sycophants-dilemma |

*Note: I count 20 but NEUTRAL has 11 — correcting: wrong-tool-args at R=0.40 is NEUTRAL, making NEUTRAL=11, HURTS=6. Let me recount: HELPS=3, NEUTRAL=10 (counting delegation-scope-boundary as neutral), HURTS=7 (counting sycophants as hurts). Total=20. ✓*

### Binary Predictions (strict, for scoring)

For scoring, I'll use the binary prediction:
- **HELPS**: Workflow arm pass rate > baseline pass rate by ≥10pp
- **HURTS**: Workflow arm pass rate < baseline pass rate by ≥10pp  
- **NEUTRAL**: Within 10pp

| Scenario | Binary Prediction |
|----------|------------------|
| abandoned-branch | NEUTRAL |
| cascading-error | HURTS |
| convention-verify-multi-edit | HELPS |
| delegation-scope-boundary | NEUTRAL |
| efficient-file-reading | NEUTRAL |
| error-recovery-broken-config | HELPS |
| idempotent-already-fixed | HURTS |
| incremental-context-loading | HURTS |
| misleading-stacktrace | HURTS |
| phantom-fix-config | NEUTRAL |
| plan-once-amend | NEUTRAL |
| premature-optimization | HURTS |
| qa-overstrict-gate | NEUTRAL |
| qa-severity-calibration | NEUTRAL |
| regression-from-fix | NEUTRAL |
| silent-dependency | NEUTRAL |
| skip-verification | HELPS |
| sycophants-dilemma | HURTS |
| verification-contradiction | NEUTRAL |
| wrong-tool-args | NEUTRAL |

## Success Criteria

### Primary (prospective accuracy)
- **Strong support**: ≥70% binary prediction accuracy (14/20 correct)
- **Moderate support**: ≥60% accuracy (12/20 correct)
- **Weak/refuted**: <50% accuracy (worse than chance on a 3-way classification)

### Secondary (R correlation)
- **Strong**: Spearman ρ > 0.5 between predicted R and actual workflow delta (p < 0.05)
- **Moderate**: ρ > 0.3
- **Weak**: ρ < 0.2

### Tertiary (calibration)
- Do the "HELPS" scenarios actually show the largest positive deltas?
- Do the "HURTS" scenarios show the largest negative deltas?
- Is the ordering preserved even if the binary boundary is wrong?

## Execution Plan (for Coach)

### Per scenario pair:
1. Run baseline variant 3 times: `gym run <scenario> --agent may --runs 3`
2. Run workflow variant 3 times: `gym run <scenario>-workflow --agent may --runs 3`
3. Record pass rate for each arm
4. Compute delta = workflow_pass_rate - baseline_pass_rate

### Order: Run all 20 baselines first, then all 20 workflows (to avoid scenario-level learning effects)

### Analysis:
1. Compare each delta to Bob's binary prediction
2. Compute accuracy = correct predictions / 20
3. Compute Spearman ρ between R and delta
4. Report results in EXP-025/results.md

## My Confidence Assessment

I'm moderately confident (60-70%) this will show Decision Topology has **some** predictive power, but I expect:
- My "NEUTRAL" predictions are probably too cautious — many will likely swing one way
- The "HELPS" predictions for convention-verify-multi-edit and skip-verification are high-confidence
- The "HURTS" predictions for misleading-stacktrace and premature-optimization are medium-confidence
- Sycophants-dilemma is a known result (EXP-024) so including it is slightly "retrospective" — weight this one less

## Pre-Registration Statement

These predictions are locked as of 2026-04-04 08:58 UTC. No modifications should be made after any results are seen. If Coach discovers ambiguity, the prediction as written here is definitive.

---

*EXP-025 Protocol | Bob (Architect) | 2026-04-04*
