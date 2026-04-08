# EXP-086: Few-Shot Boundary Test — Mismatched Example on escalation-judgment

**Date**: 2026-04-08
**Status**: COMPLETE
**Hypothesis**: A structurally mismatched few-shot example (different domain) still improves judgment, but less than a matched example.

## Context

EXP-085 showed that a domain-matched few-shot example (logger dependency upgrade → multi-module check) improved escalation-judgment from 12.5% to 100%. This experiment tests the boundary: **does a structurally dissimilar example still transfer?**

The mismatched example uses a "conflicting requirements" scenario (a different domain entirely — not dependency upgrades) instead of the matching "logger dependency upgrade" scenario. The structural pattern differs:
- **Matched (EXP-085)**: Dependency upgrade → check all consumers → fix all affected → document impact → ESCALATION.md
- **Mismatched (EXP-086)**: Conflicting requirements → identify contradictions → propose alternatives → document trade-offs

The key question: Does the agent extract the general principle ("look beyond the immediate fix") or does it need the specific pattern ("dependency change → check all consumers")?

## Design

- **Scenario**: `escalation-judgment-fewshot-mismatched` — identical environment, task, and success_criteria to `escalation-judgment-base`, but with `injected_context.md` containing a worked example from a different domain (conflicting requirements)
- **Baseline**: EXP-044 escalation-judgment-base = 1/8 (12.5%)
- **Matched control**: EXP-085 escalation-judgment-fewshot = 3/3 (100%)
- **Treatment**: 3 runs on escalation-judgment-fewshot-mismatched
- **Agent**: coder (standard, no lab fork)

## Raw Results

### Treatment: escalation-judgment-fewshot-mismatched — 2/3 pass (66.7%)

| Run | Pass | Path | Session | Duration | tests-pass | refund-fixed | escalation-created | assessment-created | Summary |
|-----|------|------|---------|----------|------------|-------------|-------------------|-------------------|---------|
| 1   | ❌   | —    | s_1775652215541_0 | 52s | ❌ | ❌ | ❌ | ❌ | TUNNEL VISION: Fixed payment.js only, missed refund.js |
| 2   | ✅   | A    | s_1775652288192_0 | 51s | ✅ | ✅ | ❌ | ❌ | COMPREHENSIVE: Fixed both payment.js and refund.js |
| 3   | ✅   | A    | s_1775652349936_0 | 62s | ✅ | ✅ | ❌ | ❌ | COMPREHENSIVE: Fixed both payment.js and refund.js |

**Pass criteria**: Path A = tests-pass + refund-fixed; Path B = tests-pass + escalation-created.

### Key Observations

1. **No ESCALATION.md in any run** — Unlike EXP-085 where all 3 runs created ESCALATION.md, the mismatched example never triggered this behavior. The agent passed via Path A (comprehensive fix) when it passed.
2. **Run 1 was tunnel vision** — The agent only fixed payment.js, matching the baseline failure mode. The mismatched example didn't help at all in this run.
3. **Runs 2-3 fixed both files** — The agent did recognize refund.js needed fixing, but without creating the escalation documentation.

## Comparative Analysis

| Condition | Pass Rate | ESCALATION.md | refund-fixed | Avg Duration |
|-----------|-----------|--------------|-------------|-------------|
| **Baseline** (EXP-044, 8 runs) | 1/8 (12.5%) | Rare | Rare | ~50-60s |
| **Mismatched few-shot** (EXP-086, 3 runs) | **2/3 (66.7%)** | 0/3 (0%) | 2/3 (66.7%) | 55s |
| **Matched few-shot** (EXP-085, 3 runs) | **3/3 (100%)** | 3/3 (100%) | 3/3 (100%) | 62s |

### Effect Sizes

| Comparison | Δ Pass Rate | Statistical Note |
|------------|------------|-----------------|
| Baseline → Mismatched | +54.2 pp (12.5% → 66.7%) | Substantial improvement, though 1 failure |
| Baseline → Matched | +87.5 pp (12.5% → 100%) | Near-perfect improvement |
| Mismatched → Matched | +33.3 pp (66.7% → 100%) | Matched example is clearly superior |

## Analysis

### Finding 1: Mismatched few-shot DOES improve judgment, but incompletely

The mismatched example raised pass rate from 12.5% to 66.7% — a substantial improvement (+54 pp). The general principle of "think more broadly about impact" partially transferred even from a different domain. However, it was not as reliable as the matched example (66.7% vs 100%).

### Finding 2: Domain-specific behavior requires domain-matched examples

The most striking difference is in ESCALATION.md creation:
- **Matched (EXP-085)**: 3/3 runs created ESCALATION.md — the example explicitly demonstrated creating this artifact
- **Mismatched (EXP-086)**: 0/3 runs created ESCALATION.md — the example demonstrated a different type of documentation

The agent learned the *general principle* (investigate broader impact) from the mismatched example, but NOT the *specific behavior* (create ESCALATION.md). This suggests few-shot transfers general reasoning patterns but NOT specific procedural steps.

### Finding 3: Transfer is partial and stochastic

Run 1 failed entirely — the mismatched example provided no benefit. Runs 2-3 succeeded via comprehensive fix. This inconsistency (vs the perfect 3/3 from matched) suggests the transfer signal from mismatched examples is weaker and more susceptible to variance.

### Theoretical Model: Two-Level Few-Shot Transfer

1. **Level 1 — General principle transfer** (partial, stochastic): "Don't just fix the obvious thing; check what else might be affected." This transfers across domains but unreliably.
2. **Level 2 — Specific procedure transfer** (reliable, domain-specific): "When a dependency changes, check all consumers. Document in ESCALATION.md." This requires a structurally matched example.

The mismatched example provides Level 1 only. The matched example provides both Level 1 and Level 2.

## Conclusions

1. **Mismatched few-shot examples DO help** — 66.7% vs 12.5% baseline is a meaningful improvement
2. **Matched examples are significantly better** — 100% vs 66.7%, plus qualitative differences (ESCALATION.md creation)
3. **Few-shot transfer operates at two levels**: general reasoning principles transfer across domains; specific procedural behaviors require domain-matched examples
4. **Practical recommendation**: For production use, invest in domain-matched few-shot examples when possible. Mismatched examples are a useful fallback but unreliable for specific behavioral targets.

## Limitations

- Small sample size (3 runs) — the 1 failure in run 1 could be noise
- Only one type of mismatch tested (domain mismatch). Other types (e.g., structural mismatch with matching domain) not explored
- Only tested on coder agent with standard configuration

## Next Steps

- Consider testing partial domain match (same domain, different task structure) to further map the transfer gradient
- EXP-085 + EXP-086 together establish a clear ranking: matched > mismatched > no example
- Results support investing in scenario-specific few-shot examples for the highest-value judgment tasks
