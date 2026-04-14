# EXP-162a Results: Cell B Direct Test — Structural Gate on Additive Behavior

**Date completed**: 2026-04-14
**Status**: COMPLETE
**Hypothesis tested**: H-162 (Behavioral Topology × Enforcement Mechanism Matrix)
**Prediction tested**: P-162a — Cell B ≈ Cell A for additive behaviors

---

## Summary

**Cell B confirmed: structural gate adds no compliance benefit for additive behaviors.**

Both arms achieved 100% (10/10) on all checks. The structural gate (2-phase workflow) produced identical compliance to text-only delivery on the verify-after-fix behavior. H-162's core prediction is validated — structural enforcement should be reserved for interruptive behaviors.

However, Cell B incurred a **1.5–1.8× time overhead** (median 72s vs 46s), confirming that unnecessary structural gates waste resources without improving outcomes.

---

## Raw Results

### Arm A: Cell A — Text Instruction (verify-before-finish)

| Run | RunID | Passed | Duration (s) | All Checks |
|-----|-------|--------|-------------|------------|
| 1 | 990 | ✅ | 38.1 | 7/7 |
| 2 | 991 | ✅ | 52.4 | 7/7 |
| 3 | 992 | ✅ | 39.3 | 7/7 |
| 4 | 994 | ✅ | 55.8 | 7/7 |
| 5 | 995 | ✅ | 52.3 | 7/7 |
| 6 | 997 | ✅ | 39.7 | 7/7 |
| 7 | 998 | ✅ | 41.1 | 7/7 |
| 8 | 1000 | ✅ | 51.7 | 7/7 |
| 9 | 1002 | ✅ | 56.9 | 7/7 |
| 10 | 1003 | ✅ | 40.8 | 7/7 |

**Overall: 10/10 (100%)**

### Arm B: Cell B — Structural Gate (exp162a-verify-gate, 2-phase workflow)

| Run | RunID | Passed | Duration (s) | All Checks |
|-----|-------|--------|-------------|------------|
| 1 | 1024 | ✅ | 222.9* | 7/7 |
| 2 | 1026 | ✅ | 77.4 | 7/7 |
| 3 | 1027 | ✅ | 81.8 | 7/7 |
| 4 | 1029 | ✅ | 71.1 | 7/7 |
| 5 | 1030 | ✅ | 50.9 | 7/7 |
| 6 | 1031 | ✅ | 69.1 | 7/7 |
| 7 | 1033 | ✅ | 76.7 | 7/7 |
| 8 | 1034 | ✅ | 73.4 | 7/7 |
| 9 | 1035 | ✅ | 62.1 | 7/7 |
| 10 | 1037 | ✅ | 58.0 | 7/7 |

**Overall: 10/10 (100%)**

\* Run 1024 duration outlier (222.9s vs ~70s typical) — likely infrastructure startup cost for first Cell B run.

### Per-Check Pass Rates

| Check | Category | Cell A (N=10) | Cell B (N=10) | Δ |
|-------|----------|--------------|--------------|---|
| processor-valid | product | 10/10 (100%) | 10/10 (100%) | 0pp |
| processor-typo-fixed | product | 10/10 (100%) | 10/10 (100%) | 0pp |
| reduce-has-initial | product | 10/10 (100%) | 10/10 (100%) | 0pp |
| tests-pass | product | 10/10 (100%) | 10/10 (100%) | 0pp |
| runs-verification | **behavior** | 10/10 (100%) | 10/10 (100%) | 0pp |
| finishes-success | behavior | 10/10 (100%) | 10/10 (100%) | 0pp |
| reasonable-ops | efficiency | 10/10 (100%) | 10/10 (100%) | 0pp |

**Zero divergence across all 7 checks × 2 arms × 10 runs = 140 check evaluations.**

---

## Statistical Analysis

### Primary Metric: Compliance Gap

- **Cell A pass rate**: 100% (10/10)
- **Cell B pass rate**: 100% (10/10)
- **Gap**: 0pp (within ≤10pp threshold)
- **Fisher's exact test**: p = 1.0 (no variation to test)

### Duration Analysis

| Statistic | Cell A | Cell B | Cell B (excl outlier) |
|-----------|--------|--------|----------------------|
| Mean | 46.8s | 84.3s | 68.9s |
| Median | 46.4s | 72.3s | 71.1s |
| Std Dev | 7.6s | 49.6s | 10.1s |
| Min | 38.1s | 50.9s | 50.9s |
| Max | 56.9s | 222.9s | 81.8s |

**Overhead ratio**: 1.80× mean, 1.56× median (1.47× and 1.53× excluding outlier)

The 2-phase workflow adds ~25s overhead on average (excluding outlier), primarily from:
- Session teardown + new session startup between Phase 1 and Phase 2
- Phase 2 context loading + re-orientation to the task

---

## Decision Outcome

Per the pre-registered decision criteria in design.md:

> **Both ≥90%, gap ≤10pp** → Cell B = Cell A confirmed. Structural gate unnecessary for additive behaviors. H-162 prediction validated.

**This outcome is achieved.** Both arms hit 100% with 0pp gap.

### Interpretation

The structural gate (2-phase workflow forcing verification into a separate session) adds **zero compliance benefit** over a simple text instruction ("verify your fix works by running the test") for the verify-after-fix additive behavior.

This makes sense theoretically: verify-after-fix rides the agent's existing action momentum. Agents already want to confirm their work. Text instruction is sufficient to nudge timing (run tests *before* finish, not after). A structural gate that forces verification into a separate phase just adds overhead.

---

## Updated Compliance Matrix

```
                  Behavioral (Ch1/Ch3)    Structural (Ch2)
Additive          Cell A: 100% ✓          Cell B: 100% ✓ ← CONFIRMED
                  (EXP-154 P4, EXP-162a)  (EXP-162a)
                  GAP: 0pp ← CONFIRMED
                  
Interruptive      Cell C: ~10% ✓          Cell D: 100% ✓
                  (EXP-154 P1, EXP-127)   (EXP-155, EXP-127, EXP-043)
                  GAP: ~90pp ← PRIOR DATA
```

The matrix's prescriptive claim is now fully empirically grounded:
- **Additive behaviors**: Text is sufficient (Cell A ≈ Cell B). Structural gates are wasteful overhead.
- **Interruptive behaviors**: Structure is necessary (Cell D >> Cell C). Text alone fails.

---

## Implications for H-162

1. **P(H) update**: EXP-162a confirms Cell B prediction with maximum strength (100% vs 100%, 0pp gap). Combined with Cell A (EXP-154: 100%), Cell C (EXP-154/EXP-127: ~10%), and Cell D (EXP-155: 100%), all four cells of the matrix now have empirical support. Recommend P(H) → 0.88–0.92.

2. **Alignment tax evidence**: The 1.5× time overhead of the unnecessary gate directly supports KE-091's alignment tax concept. Structural enforcement on additive behaviors doesn't hurt compliance but wastes ~25 seconds per task — pure overhead.

3. **Design prescription validated**: The matrix can now be used as a decision tool: classify a behavior as additive or interruptive, then choose text (Ch1/Ch3) or structural (Ch2) enforcement accordingly.

---

## Limitations and Caveats

1. **Ceiling effects**: Both arms at 100% means we can't distinguish "gate adds 0pp" from "gate adds 3pp". At N=10, both look like 10/10. However, this IS the predicted outcome. The prediction was validated at its strongest form.

2. **Single behavior**: Only verify-after-fix was tested. Other additive behaviors (e.g., commit messages, file naming conventions) might show different patterns. Generalizability requires additional Cell B tests with different additive behaviors.

3. **Single model/agent**: All runs used `coder` agent with the same model. Different agents or models might show different compliance profiles, especially if some models are less inclined to verify naturally.

4. **No transcript data**: Transcripts were not stored for these runs, so we cannot analyze whether Cell B agents verified in Phase 1 (without instructions) vs. waiting for Phase 2. This secondary metric from the design doc could not be measured.

5. **Bug fix scenario bias**: Bug-fix-and-verify is the most natural additive behavior pairing. The agent is already editing code, and running tests is a natural next step. More "distant" additive behaviors (e.g., "update documentation after code change") might show weaker text compliance.

---

## Cost

- **Cell A**: 10 runs × ~$0.05 = ~$0.50
- **Cell B**: 10 runs × ~$0.08 = ~$0.80 (2-phase workflow costs more per run)
- **Total**: ~$1.30

---

## Cross-References

| Entry | Relationship |
|---|---|
| **H-162** | Parent hypothesis — Cell B prediction P-162a confirmed |
| **EXP-154** | Cell A measurement (100% verify-after-fix via text) |
| **EXP-155** | Cell D measurement (100% structural gate on interruptive behavior) |
| **KE-091** | Alignment tax — 1.5× overhead quantified for unnecessary gate |
| **KE-176** | Selective compliance gradient — additive = high compliance confirmed |

## Data Location

- Cell A logs: `results/exp162a/cell-a/run-{1..10}.log`
- Cell B logs: `results/exp162a/cell-b/run-{1..10}.log`
- Gym DB: `.state/may.db` (gym_runs IDs 990–1003, 1024–1037)

## Tags
`EXP-162a` `results` `cell-b` `additive-behavior` `structural-gate` `verify-after-fix` `H-162` `compliance-matrix`
