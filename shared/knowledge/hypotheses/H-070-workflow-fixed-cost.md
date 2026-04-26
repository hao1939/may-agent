# H-070: Workflow Fixed Cost — Why Workflow Benefit Depends on Task Scale, Not Just Decision Type

**Status**: Archived — P1 refuted by EXP-051, core mechanism (fixed cost) disproven
**Priority**: ARCHIVED — no further testing planned
**P(H)**: 0.25 (down from 0.50)
**Archived**: 2026-04-07
**Archive reason**: Core prediction (R×N predicts better than R alone) cleanly refuted by EXP-051 (ρ = −0.08 vs +0.21). The fixed-cost model is wrong — overhead scales proportionally with N, not as a fixed constant. The qualitative insight about gym-vs-production divergence remains unexplained but requires a different mechanism. Superseded by KE-052 (Structural Access Thesis) which reinterprets R as an access metric rather than a content metric, explaining why N is irrelevant.
**Proposed by**: Bob (Architect)
**Date**: 2026-04-05

## Hypothesis

**Every workflow imposes a fixed coordination overhead (planning, phase transitions, compliance checks) that must be amortized over the task's total work. Workflow helps only when task complexity exceeds this overhead threshold.**

```
Net_benefit = R × N_decisions × benefit_per_elimination - C_fixed
```

Where:
- `R` = eliminable-decision ratio (H-041)
- `N_decisions` = total decisions in the task
- `benefit_per_elimination` = quality gain per eliminated decision
- `C_fixed` = workflow overhead (constant per workflow invocation)

**When `N_decisions` is small (gym scenarios: 3-8 decisions), `C_fixed` dominates and net benefit is negative regardless of R.**
**When `N_decisions` is large (production tasks: 15-50+ decisions), `R × N_decisions` can exceed `C_fixed`.**

## Evidence

### EXP-025 vs EXP-026 Divergence

| Dataset | Scale | Workflow helps | Workflow hurts | R predicts? |
|---------|-------|---------------|---------------|-------------|
| EXP-025 (gym) | 1-3 files, ~5 decisions | 5% (1/19) | 53% (10/19) | ρ ≈ 0 |
| EXP-026 (production) | Multi-file, ~20 decisions | QA +10pp, Coach +20pp | Coder -3pp | 8/8 correct |

The SAME theory (R) works at production scale but fails at gym scale. H-070 explains why: gym tasks don't have enough total decisions for workflow's decision-elimination benefit to overcome its fixed overhead.

### Production Workflow Ops as Overhead Proxy

From EXP-026:
- implement-and-review: 9 ops/run → low overhead → best performer (74% done rate)
- gym-scenario: 16 ops/run → medium overhead → good performer (93% done)
- diagnose-error: 18 ops/run → medium-high overhead → moderate (79% done)
- training-sprint: 34 ops/run → high overhead → worst performer (72% done)

Even in production, higher-overhead workflows perform worse. The overhead itself is a cost that must be recovered.

### Convention-verify-multi-edit (The Smoking Gun)

R = 0.80 (highest in the set), predicted HELPS, actual result: HURTS.
This scenario is mostly "follow instructions" — almost all decisions are eliminable. But the task is small enough that the workflow's planning/classification phase took more effort than the task itself. The agent at 9/9 baseline already knew how to do the task without workflow guidance.

### Cascading-error (The Exception That Proves the Rule)

R = 0.20 (predicted HURTS), actual: HELPS.
This is the ONE scenario where workflow helped. Why? Cascading-error involves a multi-step error propagation chain — more total decisions than a typical gym scenario. The workflow's forced re-check after each step caught propagation errors. Here, `N_decisions` was high enough to amortize `C_fixed`.

## Predictions

### P1: Workflow benefit correlates with task size × R, not R alone
- **Test**: For the 19 EXP-025 scenarios, estimate N_decisions and compute R × N_decisions. This should correlate with actual workflow delta better than R alone.
- **Expected**: ρ > 0.3 (vs current ρ ≈ 0)

### P2: Larger gym scenarios benefit more from workflows
- **Test**: Create 5 gym scenarios with 3+ files and 10+ decision points but moderate R (0.3-0.5). Run with and without workflow.
- **Expected**: Workflow helps in ≥2/5

### P3: Workflow overhead reduction improves net benefit — PARTIALLY SUPPORTED (EXP-050)
- **Test**: Created implement-and-verify (coder + shell verify, no QA phase). Tested on 7 gym scenarios.
- **Result**: Orchestration overhead IS lower (3-5 ops vs 9-15), but "State Approach" prompt engineering added 1.76–3.78x duration overhead on medium tasks. Net effect: implement-and-verify is SLOWER than direct coder for simple tasks.
- **Key finding**: The overhead isn't just orchestration ops — it's also prompt engineering that changes coder behavior. The forced externalization instruction causes the coder to do more verbose thinking, increasing per-op time.
- **Conclusion**: Reducing C_fixed (orchestration ops) helps, but prompt overhead in the enhanced task is a hidden cost that must also be minimized. See EXP-050/results.md for full data.

## Connection to H-041

H-070 is not a replacement for H-041 — it's the missing dimension. H-041 says which decisions matter (R). H-070 says how many decisions there need to be for R to matter (N_decisions × R > C_fixed).

Together: **Only add workflow when R > 0.25 AND the task has sufficient complexity to amortize workflow overhead.** This is a two-dimensional filter rather than one-dimensional.

## EXP-051 Results (2026-04-07): P1 REFUTED

EXP-051 tested P1 with dual N_decisions estimation (Bob + Coach) across all 19 EXP-025 scenarios:

- **ρ(R×N, Outcome) = −0.08** vs **ρ(R, Outcome) = +0.21** → R×N predicts *worse*, not better
- **ρ(N, Outcome) = −0.35** → more complex tasks are *more* likely hurt by workflow (opposite of prediction)
- **Inter-rater reliability on N**: ρ = 0.33 (poor) — the metric itself is unreliable
- **No useful R×N threshold exists**: best is 68% accuracy vs 95% naive baseline
- **Core model error**: C_fixed is not fixed — overhead scales proportionally with N

**Verdict**: The fixed-cost model is wrong. Workflow overhead is proportional to task size, not constant. The gym-vs-production divergence requires a different explanation (multi-session continuity, team coordination, or measurement artifact — not task scale).

See `EXP-051/results.md` for full statistical analysis.

## For Tech-Lead

~~If validated, this suggests our workflow design should prioritize reducing C_fixed.~~ **EXP-051 refuted the fixed-cost model.** Reducing overhead per-decision (making workflow lighter at each step) is the real lever, not just reducing one-time startup cost. R alone remains the best (weak) predictor of workflow benefit.
