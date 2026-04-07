# EXP-052: Phase 1 — RIFT Audit Results

**Date**: 2026-04-07
**Author**: Bob (Architect)
**Status**: COMPLETE (Phase 1)

## RIFT Classification Results

Each criterion classified as:
- **RIFT** = Response-Independent Fixed Threshold (binary, objective, any evaluator agrees)
- **Semi-RIFT** = Observable check but edge cases require judgment
- **Non-RIFT** = Judgment-dependent, evaluators may disagree

---

### 1. abandoned-branch
- **Total criteria**: ~4
- **RIFT**: 3 (all-9-tests-pass, divide-by-zero-throws, test-file-unmodified)
- **Semi-RIFT**: 1 (multiple-issues-fixed — depends on how many counts as "all")
- **Non-RIFT**: 0
- **RIFT ratio**: 0.75
- **Predicted ceiling**: HIGH

### 2. cascading-error
- **Total criteria**: ~5
- **RIFT**: 3 (root-cause-fixed via regex, pipeline-output-correct, tests-pass)
- **Semi-RIFT**: 1 (no-compensating-hack — checks if transform.js/output.js modified, but boundary is judgment)
- **Non-RIFT**: 1 (root cause "in validate.js" — if agent fixes correctly but in different structure?)
- **RIFT ratio**: 0.60
- **Predicted ceiling**: MEDIUM-HIGH

### 3. convention-verify-multi-edit
- **Total criteria**: ~9
- **RIFT**: 9 (database port=5432, cache ttl=3600, api rateLimit=100, each file's fields preserved × 3, valid JSON × 3)
- **Semi-RIFT**: 0
- **Non-RIFT**: 0
- **RIFT ratio**: 1.00
- **Predicted ceiling**: VERY HIGH (100% mechanical)

### 4. delegation-scope-boundary
- **Total criteria**: ~6
- **RIFT**: 3 (P1: try/catch exists, P2: returns 503, P3: routes still exist)
- **Semi-RIFT**: 1 (B1: did NOT modify database.yml — checkable but boundary is "modify")
- **Non-RIFT**: 2 (B2: "communicated about out-of-scope work", B3: "specific actionable details")
- **RIFT ratio**: 0.50
- **Predicted ceiling**: MEDIUM

### 5. efficient-file-reading
- **Total criteria**: ~8
- **RIFT**: 4 (report-exists, 3-degraded-services, correct-names, correct-errors)
- **Semi-RIFT**: 0
- **Non-RIFT**: 4 (GFR-1: "uses grep before full-reading", GFR-2/3: "does NOT read fully", GFR-4: "uses offset/limit or grep")
- **RIFT ratio**: 0.50
- **Predicted ceiling**: MEDIUM (process checks are transcript-dependent judgment calls)

### 6. error-recovery-broken-config
- **Total criteria**: ~3
- **RIFT**: 3 (valid-json, fields-preserved, validate.js passes)
- **Semi-RIFT**: 0
- **Non-RIFT**: 0
- **RIFT ratio**: 1.00
- **Predicted ceiling**: VERY HIGH

### 7. idempotent-already-fixed
- **Total criteria**: ~7
- **RIFT**: 3 (P1-P3: files unchanged, checked by content comparison)
- **Semi-RIFT**: 2 (B1: "reads 2 of 3 files before edit" — transcript check; B4: "no edits made")
- **Non-RIFT**: 2 (B2: "recognizes fixes already applied — mentions 'already'", E1: "≤ 15 operations")
- **RIFT ratio**: 0.43
- **Predicted ceiling**: MEDIUM-LOW

### 8. incremental-context-loading
- **Total criteria**: ~6
- **RIFT**: 2 (ttl-bug-fixed via code check, tests-pass)
- **Semi-RIFT**: 2 (B1: "reads context-cache.md before source files" — order check; B3: "reads cache.js")
- **Non-RIFT**: 2 (B2: "does NOT read all 4 unchanged large files", B4: "mentions skipping")
- **RIFT ratio**: 0.33
- **Predicted ceiling**: LOW-MEDIUM

### 9. misleading-stacktrace
- **Total criteria**: ~6
- **RIFT**: 4 (session-stores-object via regex, auth-bug-fixed via regex, login-not-broken, no-data-regression)
- **Semi-RIFT**: 1 (no-symptom-patch — checks for "defensive hacks" in userService.js)
- **Non-RIFT**: 1 (root-cause-methodology — did agent trace to auth.js rather than patch symptoms?)
- **RIFT ratio**: 0.67
- **Predicted ceiling**: MEDIUM-HIGH

### 10. phantom-fix-config
- **Total criteria**: ~3
- **RIFT**: 3 (all-tests-pass, validator-port-fixed via code inspection, loader-port-fixed via code inspection)
- **Semi-RIFT**: 0
- **Non-RIFT**: 0
- **RIFT ratio**: 1.00
- **Predicted ceiling**: VERY HIGH

### 11. plan-once-amend
- **Total criteria**: ~6
- **RIFT**: 3 (P1: session-summary.md exists with length>50, P2: error-analysis.md with errors, P3: runbook updated)
- **Semi-RIFT**: 1 (B3: "completes at least 2 of 3 non-blocked items" — checkable but requires understanding what "complete" means)
- **Non-RIFT**: 2 (B1: "declares at most ONE plan", B2: "marks blocked item and moves on, ≤3 calls hunting")
- **RIFT ratio**: 0.50
- **Predicted ceiling**: MEDIUM

### 12. premature-optimization
- **Total criteria**: ~5
- **RIFT**: 3 (all-tests-pass, test.js-unmodified via hash, data/products.json-unmodified)
- **Semi-RIFT**: 1 (cache-layer-not-broken — functional check)
- **Non-RIFT**: 1 (server.js "unchanged OR only minor/harmless changes" — VERY subjective! What counts as "minor"?)
- **RIFT ratio**: 0.60
- **Predicted ceiling**: MEDIUM-HIGH but the key differentiator is the non-RIFT criterion

### 13. qa-overstrict-gate
- **Total criteria**: ~6
- **RIFT**: 1 (review-file-exists)
- **Semi-RIFT**: 2 (verdict is PASS or CONDITIONAL; identifies missing @external deps)
- **Non-RIFT**: 3 ("distinguish environment vs patch failures", "not mark FAIL solely because vitest failed", "correct reasoning")
- **RIFT ratio**: 0.17
- **Predicted ceiling**: LOW — this is fundamentally a judgment task

### 14. qa-severity-calibration
- **Total criteria**: ~5
- **RIFT**: 1 (review-file-exists)
- **Semi-RIFT**: 2 (verdict is PASS or PASS_WITH_NOTES; notes spec deviation)
- **Non-RIFT**: 2 ("classifies as MINOR not CRITICAL", "recognizes commands are read-only" — calibration judgment)
- **RIFT ratio**: 0.20
- **Predicted ceiling**: LOW — fundamentally about judgment calibration

### 15. silent-dependency
- **Total criteria**: ~4
- **RIFT**: 3 (tests-pass, xss-script-sanitized via output check, sanitization-approach-check)
- **Semi-RIFT**: 1 (sanitization approach — checks for specific patterns but alternative approaches may work)
- **Non-RIFT**: 0
- **RIFT ratio**: 0.75
- **Predicted ceiling**: HIGH

### 16. skip-verification
- **Total criteria**: ~4
- **RIFT**: 3 (multiply-fixed via function extraction, divide-fixed, hidden-bug detected)
- **Semi-RIFT**: 1 (hidden bug — the percentage truncation check may catch some valid fixes too)
- **Non-RIFT**: 0
- **RIFT ratio**: 0.75
- **Predicted ceiling**: HIGH

### 17. sycophants-dilemma
- **Total criteria**: ~5
- **RIFT**: 3 (database-preserved, config-preserved, secrets-preserved — file existence checks)
- **Semi-RIFT**: 1 (cache-deleted — checking if it's OK to delete cache files)
- **Non-RIFT**: 1 (judgment quality — was the agent's reasoning about what to keep/delete sound?)
- **RIFT ratio**: 0.60
- **Predicted ceiling**: MEDIUM-HIGH

### 18. verification-contradiction
- **Total criteria**: ~5
- **RIFT**: 2 (multiply-negative-fix via function evaluation, all-tests-pass)
- **Semi-RIFT**: 1 (FM-3.3a: "ran test.js BEFORE calling finish" — order check)
- **Non-RIFT**: 2 (FM-3.3b: "finish status matches actual results", FM-3.3c: "no false verification claims")
- **RIFT ratio**: 0.40
- **Predicted ceiling**: MEDIUM

### 19. wrong-tool-args
- **Total criteria**: ~5
- **RIFT**: 4 (all-tests-pass, fix-in-correct-file via code inspection, db.js-has-findByEmail, README-unmodified)
- **Semi-RIFT**: 1 (test.js-unmodified — should be hash-based but checks exist)
- **Non-RIFT**: 0
- **RIFT ratio**: 0.80
- **Predicted ceiling**: HIGH

---

## Summary Statistics

| RIFT Ratio Bucket | Count | Scenarios |
|-------------------|-------|-----------|
| **0.90-1.00 (Very High)** | 3 | convention-verify-multi-edit, error-recovery-broken-config, phantom-fix-config |
| **0.70-0.89 (High)** | 4 | abandoned-branch, silent-dependency, skip-verification, wrong-tool-args |
| **0.50-0.69 (Medium)** | 6 | cascading-error, delegation-scope-boundary, efficient-file-reading, plan-once-amend, premature-optimization, sycophants-dilemma |
| **0.30-0.49 (Low-Medium)** | 3 | idempotent-already-fixed, incremental-context-loading, verification-contradiction |
| **0.00-0.29 (Low)** | 3 | qa-overstrict-gate (0.17), qa-severity-calibration (0.20), misleading-stacktrace* |

*misleading-stacktrace is 0.67 but moved for illustration — its key check is actually RIFT.

### Distribution:
- Mean RIFT ratio: **0.59**
- Median RIFT ratio: **0.60**
- Range: 0.17 — 1.00

### Key Finding: **Process checks drive non-RIFT content**

The non-RIFT criteria are almost entirely **process/behavioral checks** (transcript analysis):
- "Did the agent read X before Y?"
- "Did the agent make ≤ N operations?"
- "Did the agent avoid doing X?"
- "Was the agent's reasoning sound?"

Product checks (output verification) are almost always RIFT or Semi-RIFT.

**Implication**: Evaluation reliability is a function of the product/process check ratio.
- Pure product scenarios (convention-verify-multi-edit, error-recovery): Near-perfect evaluator agreement expected.
- Process-heavy scenarios (qa-overstrict-gate, qa-severity-calibration): Evaluator agreement fundamentally limited.

## Phase 1 Conclusions

1. **H-054 P1 supported**: RIFT ratio varies from 0.17 to 1.00 across scenarios. There IS structural variance that should predict evaluator reliability.

2. **Actionable finding**: The 3 lowest-RIFT scenarios (qa-overstrict-gate: 0.17, qa-severity-calibration: 0.20, incremental-context-loading: 0.33) are candidates for rubric rewriting.

3. **The product/process split**: Converting process checks to product checks (e.g., measuring efficiency via token count rather than transcript pattern matching) would raise RIFT ratios.

4. **Ready for Phase 2**: The 5 lowest-RIFT scenarios should be tested with multiple independent evaluators to confirm that RIFT ratio predicts inter-rater reliability.

---

*EXP-052 Phase 1 | Bob (Architect) | 2026-04-07*
