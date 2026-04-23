# KE-348: Recognition Threshold Model Refuted — Hints Don't Reliably Cross Performance Thresholds

**Rating**: ★★★★
**Source**: EXP-177 (N=80, 4 arms × 2 scenarios × 10 trials)
**Date**: 2026-06-23

## Core Finding

H-166-revised (any causal pointer ≥80%) is decisively REFUTED. On clean environments, hints have near-zero effect: BASE 0/10, LEXICAL 1/10, PARAPHRASE 0/10, PLACEBO 0/10 on S1 (cascading-fix-trap-v2). The original 10/10 "moderate hint" result was a small-N fluke amplified by selection and contaminated test environments.

## Evidence

### S1: cascading-fix-trap-v2 (clean re-run after contamination fix)
All arms ≈0%. 39/40 trials fail on exactly one check: `pipeline-order-fixed`. Agent always fixes threshold bug but never discovers ordering bug, regardless of hints.

### S2: sql-injection-in-query-builder  
BASE 60% vs LEXICAL 10% — hint HURT by 50pp (negative transfer/fixation).

### Pooled (N=20/arm)
BASE 30%, LEXICAL 10%, PARAPHRASE 20%, PLACEBO 15%. No arm beats baseline.

## Key Insights

1. **Scenario intrinsic difficulty dominates** — S2 at 60% base vs S1 at 0% base. Hint content is secondary.
2. **Hints can cause fixation** — LEXICAL hint on S2 reduced pass rate by 50pp, consistent with KE-133 template displacement.
3. **Pipeline-ordering is a specific cognitive blind spot** — 39/40 fail on exactly this one check. Not general inability; targeted relational reasoning failure.
4. **Small-N results are unreliable** — the 10/10 that motivated H-166-revised was not robust.

## Connections

- Refutes H-166-revised (P(H) 0.75→≤0.15)
- Extends KE-133 (few-shot/hint fixation)
- Informs KE-171 (difficulty calibration — S1 is floor scenario)
- Connects EXP-195, EXP-198, EXP-199 (all test same scenario)
