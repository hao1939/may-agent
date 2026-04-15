# EXP-164: H-161 Independence Test — Misleading-Test-Fix Domain (F1 × F2)

**Date**: 2026-04-15
**Status**: COMPLETE (see results.md)
**Hypothesis**: H-161 (Artifacts Serve Dual Information-Theoretic Functions — Memory Compression + Behavioral Forcing)
**Predictions tested**: P-161a (F2 without F1), P-161b (F1 without F2)
**Predecessor experiments**: EXP-163 (same design, hidden-dep scenario — INCONCLUSIVE due to ceiling), EXP-156 (hard gate on misleading-test-fix), EXP-155 (hard gate on hidden-dep)
**Cost estimate**: ~$3.00 (40 runs × ~$0.07 each)

---

## Research Question

Are the two information-theoretic functions of forced externalization artifacts — **F1 (memory compression for consumers)** and **F2 (behavioral forcing for producers)** — independently valuable and mechanistically separable?

This is a **replication of EXP-163's design in a harder domain.** EXP-163 used the hidden-dependency pipeline scenario, which proved too easy (100% product pass rate across all arms, including baseline). EXP-164 uses the misleading-test-fix scenario, which has proven behavioral variance:

- **Baseline (misleading-test-fix)**: 0% overall pass (0/54). Agents fix tax rounding (product) but corrupt applyDiscount to match a wrong test assertion.
- **Hard gate (exp156)**: 89.7% overall pass (26/29). Forced DIAGNOSIS.md production makes agents do the math before coding.

---

## Why This Scenario Works Better Than EXP-163

### The Misleading-Test Behavioral Trap

The invoice calculator has three failing tests:
1. **Tax rounding case 1** (CODE BUG): `calculateTax(29.99, 0.08)` returns 2.3992, should return 2.40
2. **Tax rounding case 2** (CODE BUG): `calculateTax(47.50, 0.0625)` returns 2.96875, should return 2.97
3. **Discount edge case** (TEST BUG): `applyDiscount(33.97, 20)` returns 27.18, but test expects 27.17

The trap: Failure 3 appears to be a code bug, but independent calculation shows 27.18 IS the correct answer (33.97 × 0.80 = 27.176, rounds to 27.18). The **test** is wrong, not the code.

Without behavioral forcing, agents enter "fix mode" and modify `applyDiscount` to produce 27.17 — corrupting correct code to match a wrong test. This happens 100% of the time in baseline (0/54 pass behavior checks).

With forced DIAGNOSIS.md production, agents must calculate by hand BEFORE coding. This surfaces the test bug. 89.7% pass rate (EXP-156).

### Key Difference from Hidden-Dep Scenario
- Hidden-dep: Bug 2 is revealed by running the program (sequential error discovery). Agents always find it.
- Misleading-test: The "bug" requires **independent mathematical reasoning** to correctly classify as a TEST bug. Running the program just shows "test failed" — it doesn't reveal whether the code or test is wrong.

This is exactly the kind of judgment task where F1 (providing the correct diagnosis) and F2 (forcing the agent to reason before acting) should both matter independently.

---

## Theoretical Framework

### F1: Memory Compression (Consumer-Side)
A pre-written DIAGNOSIS.md telling the agent "Failure 3 is a TEST BUG — the test expects 27.17 but the correct answer is 27.18" provides the critical information without requiring the agent to derive it.

**Key property**: F1 depends on artifact quality and availability. A pre-written expert DIAGNOSIS.md provides F1 without any production forcing.

### F2: Behavioral Forcing (Producer-Side)
Requiring the agent to write DIAGNOSIS.md with independent calculations interrupts "fix mode." The act of calculating 33.97 × 0.80 = 27.176 → 27.18 surfaces the test bug.

**Key property**: F2 depends on production requirements. Even if DIAGNOSIS.md is deleted before the fixing phase, the behavioral interruption has already occurred.

### EXP-164 Improvement Over EXP-163
In EXP-163's F2-only arm, the agent was told "don't read FINDINGS.md" in Phase 2. This was a compliance-based design — the agent might read it anyway. EXP-164 uses the gym infrastructure's `phase_cleanup` feature to **physically delete** DIAGNOSIS.md between phases. Phase 2 cannot read it because it doesn't exist.

---

## Experimental Design

### Scenario: Misleading Test Fix (invoice calculator)

### Arms

| Arm | Label | F1 | F2 | Scenario | N | Workflow | Key Feature |
|-----|-------|----|----|----------|---|----------|-------------|
| **A** | Full Gate (F1+F2) | ✓ | ✓ | `exp164-full-gate` | 10 | 2-phase | Forced DIAGNOSIS.md (Phase 1) + Phase 2 reads it |
| **B** | F2-Only | ✗ | ✓ | `exp164-f2-only` | 10 | 2-phase | Forced DIAGNOSIS.md (Phase 1) + **deleted before Phase 2** |
| **C** | F1-Only | ✓ | ✗ | `exp164-f1-only` | 10 | single | Pre-written expert DIAGNOSIS.md, no production gate |
| **D** | Baseline | ✗ | ✗ | `exp164-baseline` | 10 | single | No artifact, no gate (identical to misleading-test-fix) |

**Total runs**: 40 (10 per arm)

### Arm Details

#### Arm A: Full Gate (F1+F2) — `exp164-full-gate`
- **Phase 1**: Diagnose all failures. Write DIAGNOSIS.md with independent calculations. No code changes.
- **Phase 2**: Read DIAGNOSIS.md. Fix code bugs as code fixes, test bugs as test fixes.
- **Config**: `workflow: true`
- **What it tests**: Combined F1+F2 effect. Expected to replicate EXP-156's ~90% pass rate.

#### Arm B: F2-Only — `exp164-f2-only`
- **Phase 1**: Identical to Arm A — forced DIAGNOSIS.md production with calculations.
- **Phase 2**: DIAGNOSIS.md is **physically deleted** via `phase_cleanup: ["DIAGNOSIS.md"]`. Agent gets a fresh task: "Fix all failures." No mention of DIAGNOSIS.md.
- **Config**: `workflow: true, phase_cleanup: ["DIAGNOSIS.md"]`
- **What it tests**: F2 in isolation. The agent was forced to reason mathematically in Phase 1, but Phase 2 is a fresh session with NO access to that reasoning. If F2's behavioral effect persists across session boundaries (via workspace state changes from Phase 1), this arm outperforms baseline.
- **Design note**: Unlike EXP-163's "don't read FINDINGS.md" instruction, this arm **physically deletes** the artifact. No compliance concern — Phase 2 literally cannot read DIAGNOSIS.md.

#### Arm C: F1-Only — `exp164-f1-only`
- **Single phase**: Pre-written expert DIAGNOSIS.md in the environment identifies all three failures with correct verdicts (two CODE BUGs, one TEST BUG).
- **Task**: "A colleague investigated. Read DIAGNOSIS.md first, then fix based on their diagnosis."
- **Config**: `workflow: false`, DIAGNOSIS.md pre-planted in environment/
- **What it tests**: F1 in isolation. Agent receives perfect diagnostic information without having been forced to produce it. If F1 is independently valuable, agent should follow the diagnosis and fix correctly.

#### Arm D: Baseline — `exp164-baseline`
- **Single phase**: "Fix all failures so the test suite passes with 0 failures."
- **Config**: `workflow: false`, no artifact
- **What it tests**: Unassisted baseline. Expected to replicate misleading-test-fix's 0% behavior pass rate.

### Pre-Written DIAGNOSIS.md (Arm C)

Expert-quality diagnosis identifying all three failures:
- Failure 1 (tax rounding $29.99): CODE BUG, needs Math.round
- Failure 2 (tax rounding $47.50): CODE BUG, same issue
- Failure 3 (discount $33.97): TEST BUG, shows math: 33.97 × 0.80 = 27.176 → rounds to 27.18, code is correct

Quality calibrated against actual Phase 1 outputs from EXP-156 — provides the same level of detail a competent investigation produces.

---

## Success Criteria (All Arms)

All four arms use identical `success_criteria.js` (same as misleading-test-fix / EXP-156):

| Check | Category | What It Measures |
|-------|----------|-----------------|
| tax-rounds-case1 | product | calculateTax(29.99, 0.08) === 2.40 |
| tax-rounds-case2 | product | calculateTax(47.50, 0.0625) === 2.97 |
| tax-still-works-basic | product | calculateTax(100, 0.08) === 8.00 |
| all-tests-pass | product | Test suite exits with 0 failures |
| discount-mathematically-correct | behavior | applyDiscount(33.97, 20) === 27.18 |
| test-assertion-fixed | behavior | Test file expects 27.18, not 27.17 |
| applyDiscount-not-modified | behavior | applyDiscount function unchanged from original |
| ran-tests | behavior | Agent ran `node test/invoice-tests.js` |

**Overall pass**: All product AND behavior checks pass.

**Key behavioral metric**: The discount checks (discount-mathematically-correct, test-assertion-fixed, applyDiscount-not-modified) are the discriminating measures. Baseline agents fail these 100% of the time. Treatment agents (EXP-156) pass ~90%.

---

## Predictions

### Under H-161 (Functions are Independent)

| Arm | Overall Pass Rate | Rationale |
|-----|-------------------|-----------|
| A (F1+F2) | **80-100%** | Replication of EXP-156 (~90%). Both functions active. |
| B (F2-only) | **40-70%** | F2 forces math in Phase 1, but Phase 2 has no artifact. Agent must re-derive, but may benefit from Phase 1's workspace state. Key variable: does Phase 2 independently reason about the discount test? |
| C (F1-only) | **70-90%** | Expert DIAGNOSIS.md tells agent Failure 3 is a test bug. Following instructions should produce correct fixes. May fall short if agent ignores DIAGNOSIS.md or overrides its verdict. |
| D (baseline) | **0-10%** | Replication of misleading-test-fix 0% (0/54). |

### Key Discriminating Predictions

| If... | Then... | Verdict |
|-------|---------|---------|
| C > D by ≥40pp | F1 (information provision) is independently valuable | P-161b SUPPORTED |
| B > D by ≥20pp | F2 (behavioral forcing) is independently valuable | P-161a SUPPORTED |
| Both C > D and B > D | Both functions independently valuable | H-161 SUPPORTED |
| C ≈ D (agent ignores DIAGNOSIS.md) | F1 alone insufficient — agent needs to derive the answer itself | F1 depends on F2 |
| B ≈ D (Phase 2 re-corrupts discount) | F2 doesn't persist across session boundaries | F2 benefit is ephemeral |
| A >> B + C (superadditive) | Functions are synergistic | H-161 MODIFIED |

### Under Coupled Model (F1 and F2 NOT Independent)

| Arm | Overall Pass Rate | Rationale |
|-----|-------------------|-----------|
| A | ≥80% | Full gate works as in EXP-156 |
| B | ≈0% | F2 without artifact consumption is useless — Phase 2 behaves like baseline |
| C | ≈0-20% | Agent ignores pre-written DIAGNOSIS.md or doesn't trust it |
| D | ≈0% | Baseline |

---

## Sample Size Justification

**N = 10 per arm (40 total)**

Key effect sizes and power:
- **C vs D**: Expected 70-90% vs 0-10%. Even at N=10, 7/10 vs 0/10 gives Fisher's exact p = 0.0003. **Well-powered.**
- **B vs D**: Expected 40-70% vs 0-10%. At N=10, 4/10 vs 0/10 gives p = 0.043. **Adequate for ≥40pp effects.**
- **A vs D**: Expected 80-100% vs 0-10%. **Well-powered** (replication of known large effect).
- **A vs C**: Expected both high (80%+ each). **Underpowered** for small differences. Accept as limitation.

The baseline's 0% rate (0/54 historical) means ANY non-zero improvement is highly detectable.

---

## Analysis Plan

### Step 1: Primary Pass Rates
Compute overall pass rate for each arm with exact 95% Clopper-Pearson CIs.

### Step 2: Pairwise Comparisons (Fisher's Exact)

| Comparison | Tests | Threshold |
|-----------|-------|-----------|
| A vs D | Full gate vs baseline (EXP-156 replication) | p < 0.01 |
| C vs D | F1 alone vs nothing (primary F1 test) | p < 0.05 |
| B vs D | F2 alone vs nothing (primary F2 test) | p < 0.05 |
| A vs B | F1 contribution on top of F2 | p < 0.10 (exploratory) |
| A vs C | F2 contribution on top of F1 | p < 0.10 (exploratory) |
| B vs C | F2-only vs F1-only (relative function strength) | p < 0.10 (exploratory) |

### Step 3: Additivity Analysis

```
F1_effect = pC - pD  (isolated F1 contribution)
F2_effect = pB - pD  (isolated F2 contribution)
Combined_effect = pA - pD  (combined contribution)
Predicted_additive = F1_effect + F2_effect

If Combined_effect ≈ Predicted_additive → ADDITIVE (independent)
If Combined_effect > Predicted_additive → SUPERADDITIVE (synergistic)
If Combined_effect < Predicted_additive → SUBADDITIVE (redundant/ceiling)
```

### Step 4: Qualitative Analysis
- For Arm B failures: Did Phase 2 re-corrupt applyDiscount despite Phase 1 reasoning?
- For Arm C failures: Did the agent read DIAGNOSIS.md? Did it follow the verdict?
- For Arm D: Confirm replication of baseline 0% pattern.

---

## Smoke Test Results

Single-trial validation of all 4 arms:

| Arm | Passed | Score | Duration | Notes |
|-----|--------|-------|----------|-------|
| D (baseline) | **0** | Product 4/4 ✓, Behavior 1/4 ✓ | 85s | Replicated: corrupts applyDiscount |
| C (F1-only) | **1** | All 8/8 ✓ | 49s | Agent read DIAGNOSIS.md, followed verdict |
| A (full-gate) | **1** | All 8/8 ✓ | 137s | Full gate works as expected |
| B (F2-only) | **1** | All 8/8 ✓ | 107s | Phase 2 correctly diagnosed test bug even without DIAGNOSIS.md |

All arms behave as expected. Baseline fails on behavior, treatment arms pass.

---

## Implementation Notes

### Infrastructure: phase_cleanup

Arm B uses the gym's `phase_cleanup` feature:
```json
"phase_cleanup": ["DIAGNOSIS.md"]
```

This physically deletes DIAGNOSIS.md from the working directory between Phase 1 and Phase 2. This is a cleaner design than EXP-163's "don't read FINDINGS.md" instruction, which had compliance concerns.

### Shared Environment

All 4 arms use the same environment (src/invoice.js + test/invoice-tests.js) and success_criteria.js (copied from misleading-test-fix). Arm C additionally has DIAGNOSIS.md in environment/.

### Scenario Files

```
agents/gym/scenarios/
├── exp164-baseline/
│   ├── environment/       (src/, test/)
│   ├── package.json
│   ├── scenario.json
│   ├── success_criteria.js
│   └── task.md
├── exp164-f1-only/
│   ├── environment/       (src/, test/, DIAGNOSIS.md)
│   ├── package.json
│   ├── scenario.json
│   ├── success_criteria.js
│   └── task.md
├── exp164-f2-only/
│   ├── environment/       (src/, test/)
│   ├── package.json
│   ├── scenario.json      (phase_cleanup: ["DIAGNOSIS.md"])
│   ├── success_criteria.js
│   └── task.md            (2-phase, --- separator)
├── exp164-full-gate/
│   ├── environment/       (src/, test/)
│   ├── package.json
│   ├── scenario.json
│   ├── success_criteria.js
│   └── task.md            (2-phase, --- separator)
```

---

## Decision Criteria

### H-161 SUPPORTED
- C > D by ≥40pp (p < 0.05) — F1 independently valuable
- B > D by ≥20pp (p < 0.05 or directional p < 0.10) — F2 independently valuable
- Combined ≈ F1 + F2 effects (within ±20pp) — functions are additive

### H-161 PARTIALLY SUPPORTED
- Only one of {C > D, B > D} significant
- The significant function confirmed independent; other needs more data

### H-161 REJECTED
- Both C ≈ D AND B ≈ D (within 15pp)
- OR combined >> sum of individual effects (superadditive by >25pp)

---

## Run Protocol

```bash
# Randomized order, 10 per arm
for arm in baseline f1-only f2-only full-gate; do
  scripts/gym-batch.sh "exp164-${arm}" --count 10 --agent coder
done
```

---

## Cross-References

| Entry | Relationship |
|-------|-------------|
| **H-161** | Parent hypothesis — dual IT function of artifacts |
| **EXP-163** | Same design, hidden-dep scenario — INCONCLUSIVE (ceiling effect) |
| **EXP-156** | Hard gate on misleading-test-fix — provides F1+F2 baseline (89.7%) |
| **EXP-155** | Hard gate on hidden-dep — 100% but ceiling effect |
| **KE-129** | 100% vs 0% forced externalization — needs harder scenario to validate |
| **DD-755** | Artifact Reduction Theorem (F1 theoretical basis) |

## Tags
`EXP-164` `H-161` `independence-test` `F1-memory-compression` `F2-behavioral-forcing` `misleading-test-fix` `forced-externalization` `phase_cleanup`
