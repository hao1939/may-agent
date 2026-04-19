# EXP-177: Results — Recognition Threshold Confirmatory Test

**Status**: COMPLETE (S1 re-run with contamination fix; S2 from prior session)
**Date run**: 2026-04-19 (S1 re-run: 2026-04-19 ~20:00–21:40 UTC)
**Total runs**: 80 (4 arms × 2 scenarios × 10 trials)

## ⚠️ S1 Contamination Discovery & Re-run

The initial EXP-177 S1 hint variants (`cascading-fix-trap-v2-exp177-{lexical,paraphrase,placebo}`) had **pre-fixed source code** in `pipeline.js` (ordering already correct) and `homework.js` (different logic). This was caused by amy's commit `a7677d8be` fixing bugs *in the scenario files*. The S1 hint arm data from the first run (LEXICAL 3/10, PARAPHRASE 2/10, PLACEBO 0/10) was confounded.

**Fix applied**: Copied BASE `src/*.js` to all hint variants, restoring identical environments. Re-ran all 4 S1 arms (40 trials). S2 was verified clean (no code differences).

## Summary

All three pre-registered hypotheses are **refuted**. On clean S1 environments, hints have essentially zero effect: BASE 0/10, LEXICAL 1/10, PARAPHRASE 0/10, PLACEBO 0/10. The single universal failure mode is `pipeline-order-fixed` — the agent always fixes the threshold bug (>= vs >) but never discovers the pipeline ordering bug, regardless of hints.

## Data

### S1: cascading-fix-trap-v2 (RE-RUN — clean environments)

| Arm | Scenario variant | Pass | Fail | Rate | Failure pattern |
|-----|-----------------|------|------|------|-----------------|
| A1 BASE | cascading-fix-trap-v2 | 0 | 10 | 0% | 10/10 fail on `pipeline-order-fixed` only |
| A2 LEXICAL | cascading-fix-trap-v2-exp177-lexical | 1 | 9 | 10% | 9/10 fail on `pipeline-order-fixed` only |
| A3 PARAPHRASE | cascading-fix-trap-v2-exp177-paraphrase | 0 | 10 | 0% | 10/10 fail on `pipeline-order-fixed` only |
| A4 PLACEBO | cascading-fix-trap-v2-exp177-placebo | 0 | 10 | 0% | 10/10 fail on `pipeline-order-fixed` only |

**Diagnostic finding**: 39/40 S1 trials failed on exactly ONE check (`pipeline-order-fixed`), passing all other 8 checks including `grade-threshold-fixed`. The agent reliably finds and fixes the `>` vs `>=` threshold bug but cannot discover the pipeline ordering issue (penalize must come before normalize). Hints explicitly describing this ordering problem (LEXICAL, PARAPHRASE) did not help.

### S2: sql-injection-in-query-builder

| Arm | Scenario variant | Pass | Fail | Rate |
|-----|-----------------|------|------|------|
| A1 BASE | sql-injection-in-query-builder | 6 | 4 | 60% |
| A2 LEXICAL | sql-injection-in-query-builder-exp177-lexical | 1 | 9 | 10% |
| A3 PARAPHRASE | sql-injection-in-query-builder-exp177-paraphrase | 4 | 6 | 40% |
| A4 PLACEBO | sql-injection-in-query-builder-exp177-placebo | 3 | 7 | 30% |

### Pooled (N=20 per arm)

| Arm | Pass | Fail | Rate | 95% CI |
|-----|------|------|------|--------|
| A1 BASE | 6 | 14 | 30% | 12–54% |
| A2 LEXICAL | 4 | 16 | 20% | 6–44% |
| A3 PARAPHRASE | 6 | 14 | 30% | 12–54% |
| A4 PLACEBO | 3 | 17 | 15% | 3–38% |

## Analysis

### Hypothesis adjudication

**H-166-revised (any causal pointer ≥80%)**: **REFUTED**. Predicted LEXICAL ≥80% and PARAPHRASE ≥80%. Observed 20% and 30%. The "any causal pointer crosses threshold" model is wrong — knowing the mechanism does not reliably produce a solve.

**A-LEXICAL (keyword match — LEXICAL ≥80%, PARAPHRASE ≤40%)**: **REFUTED**. LEXICAL at 20% invalidates the ≥80% prediction. The keyword-match model fails because even exact keyword hints don't reliably help.

**A-ENVCLEAN (clean env sufficient — BASE ≥40%)**: **PARTIALLY supported for S2, refuted for S1**. S2 BASE = 60% (consistent with ≥40% prediction), but S1 BASE = 0% (inconsistent). Pooled BASE = 30%, within the ambiguous zone. This suggests scenario difficulty, not environment cleanness, is the primary driver.

### Unexpected findings

1. **S2 hints HURT performance**. BASE 60% vs LEXICAL 10% — the lexical hint *reduced* pass rate by 50pp. This is a striking negative transfer effect. The hint may have caused the agent to fixate on the described bugs in a narrow way, missing the broader solution path it finds naturally.

2. **S1 lexical replication failure**. The same hint string that produced 10/10 in post-contamination controls now produces 3/10. This is a 70pp drop. Possible explanations: model version drift, stochastic variation at small N (the 10/10 was never a stable estimate), or subtle environment changes.

3. **No arm significantly outperforms any other**. Fisher exact test on pooled LEXICAL vs BASE: p=0.72. PARAPHRASE vs BASE: p=1.0. The hint manipulation has no detectable effect at N=20.

4. **Scenario heterogeneity dominates**. S1 is genuinely hard (5% across all arms), S2 is moderate (35% across all arms). The between-scenario variance dwarfs any within-scenario hint effect.

## Conclusion

The recognition threshold model (H-166-revised) is refuted: providing causal pointers does not reliably cross a threshold to high pass rates. The original 10/10 finding that motivated H-166-revised appears to have been either a small-N artifact or temporally unstable. 

**Key takeaway**: Hint-based interventions are unreliable for improving task performance. The dominant factor is scenario intrinsic difficulty, not hint content. Future work should focus on what makes scenarios intrinsically solvable (S2 at 60% base vs S1 at 0% base) rather than on hint engineering.

**H-166-revised status**: → REFUTED (P updated from 0.75 to ≤0.15)

## Run IDs

S1-BASE: 3190, 3192, 3196, 3198, 3199, 3204, 3205, 3208, 3210, 3213
S1-LEXICAL: 3195, 3201, 3207, 3215, 3220, 3223, 3225, 3227, 3228, 3229
S1-PARAPHRASE: 3193, 3197, 3202, 3206, 3211, 3216, 3218, 3222, 3224, 3226
S1-PLACEBO: 3191, 3194, 3200, 3203, 3209, 3212, 3214, 3217, 3219, 3221
S2-BASE: 3233, 3237, 3240, 3247, 3249, 3255, 3258, 3262, 3266, 3269
S2-LEXICAL: 3230, 3236, 3241, 3244, 3250, 3252, 3256, 3260, 3263, 3267
S2-PARAPHRASE: 3231, 3234, 3238, 3243, 3246, 3248, 3253, 3259, 3264, 3268
S2-PLACEBO: 3232, 3235, 3239, 3242, 3245, 3251, 3254, 3257, 3261, 3265
