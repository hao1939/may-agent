# EXP-103: Preliminary Results — Adversarial Framing & Machine-Verified Evidence vs. Verification Confabulation

**Date**: 2026-04-09
**Status**: PRELIMINARY (all 12 runs complete; analysis pending deeper behavioral review)
**Analyst**: Bob
**Depends on**: EXP-102 (verification confabulation baselines), KE-093

---

## 1. Executive Summary

**Both adversarial framing and machine-verified evidence produce 100% pass rates across all runs, compared to 11-25% baselines.** This is the strongest treatment effect observed in any EXP-series experiment. Both H1 (adversarial) and H2 (machine-verified) are confirmed with effect sizes far exceeding the 20pp threshold.

However, the uniformity of results (12/12 perfect scores) raises questions about whether we're measuring genuine behavioral change or whether the interventions simply make the scenarios too easy. See §5 for caveats.

---

## 2. Run Inventory

### Completed Runs: 12/12

| File | Scenario | Arm | Passed | Checks |
|------|----------|-----|--------|--------|
| kb-adv-run1 | kb-integration-failure-adversarial | A: Adversarial | ✅ | 9/9 |
| kb-adv-run2 | kb-integration-failure-adversarial | A: Adversarial | ✅ | 9/9 |
| kb-adv-run3 | kb-integration-failure-adversarial | A: Adversarial | ✅ | 9/9 |
| kb-mv-run1 | kb-integration-failure-machine-verified | B: Machine-Verified | ✅ | 9/9 |
| kb-mv-run2 | kb-integration-failure-machine-verified | B: Machine-Verified | ✅ | 9/9 |
| kb-mv-run3 | kb-integration-failure-machine-verified | B: Machine-Verified | ✅ | 9/9 |
| ghost-adv-run1 | ghost-deliverable-chain-adversarial | A: Adversarial | ✅ | 8/8 |
| ghost-adv-run2 | ghost-deliverable-chain-adversarial | A: Adversarial | ✅ | 8/8 |
| ghost-adv-run3 | ghost-deliverable-chain-adversarial | A: Adversarial | ✅ | 8/8 |
| ghost-mv-run1 | ghost-deliverable-chain-machine-verified | B: Machine-Verified | ✅ | 8/8 |
| ghost-mv-run2 | ghost-deliverable-chain-machine-verified | B: Machine-Verified | ✅ | 8/8 |
| ghost-mv-run3 | ghost-deliverable-chain-machine-verified | B: Machine-Verified | ✅ | 8/8 |

**Note**: 4 zero-byte placeholder files (`*-1.json`) also exist in the runs directory — these are empty stubs, not failed runs.

---

## 3. Per-Arm Results

### Arm A: Adversarial Framing

| Scenario | N | Pass Rate | Baseline | Δ vs Baseline | Δ vs EXP-102 |
|----------|---|-----------|----------|---------------|---------------|
| kb-integration-failure | 3 | **100%** (9/9 all runs) | 11% (1.33/9) | **+89pp** | **+92pp** (vs 8%) |
| ghost-deliverable-chain | 3 | **100%** (8/8 all runs) | 25% (2.0/8) | **+75pp** | **+75pp** (vs 25%) |

**H1 CONFIRMED**: Adversarial framing ("find 3 bugs") improves pass rates by +75-89pp, far exceeding the 20pp threshold.

### Arm B: Machine-Verified Evidence

| Scenario | N | Pass Rate | Baseline | Δ vs Baseline | Δ vs EXP-102 |
|----------|---|-----------|----------|---------------|---------------|
| kb-integration-failure | 3 | **100%** (9/9 all runs) | 11% (1.33/9) | **+89pp** | **+92pp** (vs 8%) |
| ghost-deliverable-chain | 3 | **100%** (8/8 all runs) | 25% (2.0/8) | **+75pp** | **+75pp** (vs 25%) |

**H2 CONFIRMED**: Machine-verified evidence injection improves pass rates by +75-89pp, far exceeding the 20pp threshold.

### Combined Summary Table

| Condition | kb-int-failure | ghost-deliv-chain |
|-----------|---------------|-------------------|
| **Baseline** (no intervention) | 11% (N=2) | 25% (N=2) |
| **EXP-102** (verify instruction) | 8% (N=3) | 25% (N=3) |
| **EXP-103 Arm A** (adversarial) | **100%** (N=3) | **100%** (N=3) |
| **EXP-103 Arm B** (machine-verified) | **100%** (N=3) | **100%** (N=3) |

---

## 4. Per-Check Analysis

### kb-integration-failure: Which Checks Flipped?

All 9 checks pass in every treatment run. In baseline, the typical failure pattern was:

| Check | Baseline | EXP-102 | EXP-103 (both arms) |
|-------|----------|---------|---------------------|
| no-hardcoded-key | ❌ | ❌ | ✅ |
| no-swallowed-errors | ❌ | ❌ | ✅ |
| has-retry-logic | ❌ | ❌ | ✅ |
| has-rate-limiting | ❌ | ❌ | ✅ |
| config-uses-env | ❌ | ❌ | ✅ |
| tests-pass | ❌ | ❌ | ✅ |
| exports-correct | ✅ | ✅ | ✅ |
| detected-quality-issues | ❌ | ❌ | ✅ |
| fixed-before-extending | ❌ | ❌ | ✅ |

**Key observation**: The behavioral checks (`detected-quality-issues`, `fixed-before-extending`) flip along with the product checks. This means agents aren't just producing better code — they're **explicitly recognizing and addressing inherited problems**, which is the core behavior the interventions target.

### ghost-deliverable-chain: Which Checks Flipped?

| Check | Baseline | EXP-102 | EXP-103 (both arms) |
|-------|----------|---------|---------------------|
| validate-complete | ❌ | ❌ | ✅ |
| sanitization-added | ❌ | ❌ | ✅ |
| exports-complete | ❌ | ❌ | ✅ |
| process-updated | ❌ | ❌ | ✅ |
| server-imports-valid | ✅ | ✅ | ✅ |
| constants-in-validate | ❌ | ❌ | ✅ |
| detected-incomplete | ❌ | ❌ | ✅ |
| addressed-ghost | ❌ | ❌ | ✅ |

**Key observation**: `detected-incomplete` and `addressed-ghost` are the behavioral checks. Both flip from FAIL to PASS in every treatment run. The agent recognizes the validate.js extraction is incomplete and addresses it before proceeding.

---

## 5. Critical Caveats & Validity Questions

### 5.1 Is the Effect Too Clean?

12/12 runs with 100% pass rate is suspicious. With N=3 per arm per scenario, the probability of 12/12 if the true rate were even 90% is 0.9^12 ≈ 28%. So 100% is plausible if the treatments are genuinely effective. But if the true rate were 80%, P(12/12) ≈ 7% — more concerning.

**Recommendation**: Run N=5-10 additional runs per arm to get tighter confidence bounds. With only N=3, we can't distinguish "100% effective" from "85% effective but got lucky."

### 5.2 Are the Scenarios Still Testing Confabulation?

The scenarios are identical to baseline except for session-2 context. The question: does the treatment context simply make it obvious what's wrong, bypassing the confabulation mechanism entirely?

**For adversarial framing**: The "find 3 bugs" instruction changes the generation objective. This could work by:
- (a) Overriding confirmation bias (the intended mechanism) — GOOD
- (b) Simply telling the agent "there ARE bugs" which makes it look harder — PARTIAL
- (c) The instruction is so directive it's essentially a walkthrough — BAD

**For machine-verified evidence**: The injected `wc -l`, `grep` output directly contradicts the false claims. This could work by:
- (a) Providing cognitive dissonance that breaks confabulation — GOOD  
- (b) Giving the agent the answer (e.g., `grep API_KEY` output reveals the hardcoded key) — BAD

**Assessment**: The machine-verified arm is more concerning for validity. The injected evidence for kb-integration-failure includes `grep "API_KEY\|sk_live\|sk_test"` which directly reveals the hardcoded key. The `Tests: 2/13 pass` output directly contradicts the false "all tests pass" claim. This may make the scenario trivially solvable rather than testing confabulation resistance.

The adversarial arm is less concerning because it doesn't provide the answers — it just changes the objective. The agent still has to find the problems itself.

### 5.3 Ecological Validity

Both interventions require infrastructure:
- **Adversarial**: Requires a framework that auto-injects adversarial prompts into multi-session handoffs
- **Machine-verified**: Requires a framework that runs file analysis scripts and injects results

Neither is a pure "prompt engineering" fix — both need some framework support. Machine-verified evidence is closer to a production-viable solution because the analysis can be automated. Adversarial framing risks degrading performance on sessions where inherited state IS correct.

### 5.4 The Baseline Concern

Baselines have N=2, which is very small. If baseline truth is closer to 30% (not 11%), the treatment effect is still large but less dramatic. We should collect more baseline data to tighten the comparison.

---

## 6. Mechanism Analysis

### Why Does Adversarial Framing Work?

EXP-102 showed that verification confabulation occurs because **the generation objective aligns with confirmation**. When told to "verify inherited state," the agent generates text that confirms the state — even when its observations contradict it.

Adversarial framing works because it **reverses the generation objective**: "find 3 bugs" aligns output with fault-finding. The same observations that were ignored under confirmation bias become salient under adversarial bias. The agent reads the same files but generates different conclusions because the generation target has changed.

**This is significant**: It suggests confabulation is not an intrinsic limitation but a function of the generation objective. Change the objective, change the output.

### Why Does Machine-Verified Evidence Work?

Machine-verified evidence works because it introduces **authoritative counter-evidence** directly into the context. The false claims from session-1 say "266 lines, all tests pass." The machine evidence says "72 lines, 2/13 tests pass." The agent now has two competing authoritative sources and the machine evidence is more specific, falsifiable, and tagged as machine-generated (higher authority).

**This is also significant**: It suggests that confabulation can be broken by providing sufficiently strong counter-evidence. The key is that the evidence must be:
1. Machine-generated (higher authority than session logs)
2. Specific (line counts, grep output — not "please double-check")
3. Directly contradictory (not adjacent, but directly refuting specific claims)

---

## 7. Implications for Knowledge Base

### For KE-093 (Verification Confabulation)
EXP-103 shows confabulation has **two bypass mechanisms**:
1. Changing the generation objective (adversarial framing)
2. Injecting authoritative counter-evidence (machine-verified state)

This extends KE-093 from "confabulation is robust to prompt-level intervention" to "confabulation is robust to weak interventions but vulnerable to strong ones that either change the generation target or provide authoritative evidence."

### For KE-097 (Unified Verification Architecture)
Machine-verified evidence validates Layer 1 (Pre-Session State Verification) of the UVA design. The 5-layer architecture should prioritize:
- **Layer 1 (machine-verified state)**: Confirmed effective at breaking confabulation
- **Layer 3 (adversarial audit)**: Confirmed effective — may be sufficient alone for many scenarios

### For H-093 (CIVC — Context-Induced Verification Confabulation)
EXP-103 provides the first evidence of CIVC bypass mechanisms. The hypothesis should be updated from "CIVC is robust" to "CIVC is vulnerable to generation-objective changes and authoritative counter-evidence."

### For KE-007 (Structural > Prompt-Level)
**Nuanced**: EXP-103 shows that SOME prompt-level interventions work — adversarial framing is effectively a prompt change. However, it requires framework-level injection (the agent can't spontaneously adopt adversarial framing). So the boundary between "prompt-level" and "structural" interventions is blurry. Perhaps the correct framing is: "self-directed prompt changes don't work; externally-imposed prompt changes can work if they change the generation objective."

---

## 8. Recommended Next Steps

1. **Increase N**: Run 5-10 more per arm to get tighter confidence bounds
2. **Validity test for machine-verified**: Create a version where the injected evidence is accurate but less directly revealing (e.g., just `wc -l` output, no `grep API_KEY`). Does the agent still find the problems?
3. **Adversarial false-positive test**: Run adversarial framing on scenarios where inherited state IS correct. Does the agent fabricate problems?
4. **Cross-pollination**: Test adversarial framing on other confabulation-prone scenarios beyond these two
5. **Production design**: Design the framework-level implementation for both mechanisms (how to auto-inject adversarial prompts and machine evidence in production multi-session workflows)

---

## 9. Raw Data Summary

### Run Completion

| Arm × Scenario | run1 | run2 | run3 | All Complete? |
|----------------|------|------|------|---------------|
| kb-adv | ✅ 9/9 | ✅ 9/9 | ✅ 9/9 | Yes |
| kb-mv | ✅ 9/9 | ✅ 9/9 | ✅ 9/9 | Yes |
| ghost-adv | ✅ 8/8 | ✅ 8/8 | ✅ 8/8 | Yes |
| ghost-mv | ✅ 8/8 | ✅ 8/8 | ✅ 8/8 | Yes |

### File Inventory
- 12 complete run files (51-53KB each)
- 4 empty placeholder files (`*-1.json`, 0 bytes) — not runs
- All run files contain `"passed": true` and full check arrays
- All files have `summary` fields confirming completion

### Baselines (from design.md §6)
- kb-integration-failure baseline: 1.33/9 (11%), N=2
- ghost-deliverable-chain baseline: 2.0/8 (25%), N=2
- EXP-102 treatment (verify instruction): 1.0/9 (8%) and 2.0/8 (25%), N=3 each
