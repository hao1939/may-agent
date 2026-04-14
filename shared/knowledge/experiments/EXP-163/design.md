# EXP-163: H-161 Independence Test — Dual IT Function of Artifacts (F1 × F2)

**Date**: 2026-04-14
**Status**: DESIGNED
**Hypothesis**: H-161 (Artifacts Serve Dual Information-Theoretic Functions — Memory Compression + Behavioral Forcing)
**Predictions tested**: P-161a (F2 without F1), P-161b (F1 without F2)
**Predecessor experiments**: EXP-155 (Cell D, Ch2 gate on hidden-dep), EXP-154 (baseline + Ch1 skill), EXP-162a (methodology model)
**Cost estimate**: ~$3.00 (40 new gym runs × ~$0.07 each, avg across 1-phase and 2-phase)

---

## Research Question

Are the two information-theoretic functions of forced externalization artifacts — **F1 (memory compression for consumers)** and **F2 (behavioral forcing for producers)** — independently valuable and mechanistically separable?

H-161 claims they are. This experiment tests that claim by creating conditions where each function operates in isolation.

---

## Theoretical Framework

### F1: Memory Compression (Consumer-Side)
DD-755's Artifact Reduction Theorem: artifacts compress history without losing predictive information. In our system: a FINDINGS.md listing Bug 1 and Bug 2 allows the fixing phase to skip re-derivation of what's wrong. The artifact persists in the environment and reduces the internal capacity needed for the subsequent phase.

**Key property**: F1 depends on artifact *quality* and *availability*. It does NOT require the producer to have been forced to create it. A pre-written expert FINDINGS.md provides the same F1 benefit.

### F2: Behavioral Forcing (Producer-Side)
KE-129's mechanism: requiring artifact production interrupts action momentum. Writing FINDINGS.md forces the agent to enumerate observations before acting, which surfaces hidden bugs that "fix mode" would miss.

**Key property**: F2 depends on *production requirements* and *gate strength*. It does NOT require the artifact to be read later. Even if FINDINGS.md is never consumed, writing it has already achieved its behavioral forcing purpose.

### The Independence Claim
If F1 and F2 are independent:
- Removing consumption (nobody reads FINDINGS.md) should preserve F2 benefit
- Providing a pre-made artifact (no forced production) should provide F1 benefit without F2
- The full gate (forced production + consumption) should yield benefits from BOTH functions

If they're coupled:
- The full gate should outperform either function in isolation by more than the sum of their independent effects (superadditivity)
- OR one function is actually a side-effect of the other (e.g., F2 only works because agents implicitly consume their own artifact)

---

## Experimental Design

### Scenario: Hidden-Dependency Pipeline (exp144 family)

**Why this scenario**:
1. **Established baseline**: 15% overall pass rate (3/20 from EXP-154), giving room to detect improvements in both directions
2. **Validated F2 mechanism**: EXP-155 showed 100% (10/10) with full gate — the ceiling exists and is reachable
3. **Clear F1/F2 decomposition**: The task naturally separates into investigation (where F2 applies) and fixing (where F1 applies)
4. **Rich process metrics**: P1-P4 checks allow fine-grained analysis of WHERE each function operates
5. **Low cost**: ~$0.05-0.10 per run

**Task structure**: A Node.js data pipeline (`process.js`) has two bugs:
- Bug 1 (surface): `RULES_PAH` typo → immediate runtime error
- Bug 2 (hidden): Checksum in `pricing.json` is stale → validation failure AFTER fixing Bug 1

Agents who enter "fix mode" on Bug 1 tend to miss Bug 2 entirely. The artifact's behavioral forcing interrupts this momentum (F2), and its content helps the fixing phase find both bugs (F1).

### Arms

| Arm | Label | F1 | F2 | Scenario | N | Description |
|-----|-------|----|----|----------|---|-------------|
| **A** | Full (F1+F2) | ✓ | ✓ | `exp163-full-gate` | 10 | Forced FINDINGS.md production (Phase 1) + explicit consumption (Phase 2 reads it) |
| **B** | F2-only | ✗ | ✓ | `exp163-f2-only` | 10 | Forced FINDINGS.md production (Phase 1) + Phase 2 explicitly ignores it |
| **C** | F1-only | ✓ | ✗ | `exp163-f1-only` | 10 | Pre-written FINDINGS.md provided + single-phase task (no production gate) |
| **D** | Neither | ✗ | ✗ | `exp163-baseline` | 10 | Single-phase, no artifact, no gate (clean baseline) |

**Total runs**: 40 (10 per arm)

### Arm Details

#### Arm A: Full Gate (F1+F2) — `exp163-full-gate`

Replication of EXP-155's hard gate design with one modification: Phase 2 explicitly instructs the agent to read FINDINGS.md.

```
Phase 1: Investigate ALL Bugs — BUDGET: 15 TOOL CALLS MAX
[Same as EXP-155 Phase 1 — forced FINDINGS.md production with 
"MULTIPLE bugs" hint, structured deliverable requirements]

Phase 2: Fix All Bugs — BUDGET: 25 TOOL CALLS MAX
FIRST: Read your FINDINGS.md from Phase 1 carefully. Use it as your 
reference for what needs fixing. 
[Then: fix all listed bugs, verify with node process.js]

Phase 3: Verify — BUDGET: 15 TOOL CALLS MAX
[Same as EXP-155 Phase 3]
```

**Config**: `workflow: true`, 3-phase.

**What this tests**: The combined effect of F1+F2. This is the baseline for "full artifact function."

#### Arm B: F2-Only — `exp163-f2-only`

Phase 1 is identical to Arm A (forced FINDINGS.md production). But Phase 2 explicitly tells the agent NOT to use FINDINGS.md.

```
Phase 1: Investigate ALL Bugs — BUDGET: 15 TOOL CALLS MAX
[Identical to Arm A Phase 1 — forced FINDINGS.md production]

Phase 2: Fix All Bugs — BUDGET: 25 TOOL CALLS MAX
IMPORTANT: Start fresh. Do NOT read or reference FINDINGS.md from Phase 1. 
Approach the codebase as if you're seeing it for the first time. 
Read the code, identify what needs fixing, and implement fixes.
[Then: fix bugs, verify with node process.js]

Phase 3: Verify — BUDGET: 15 TOOL CALLS MAX
[Same as Arm A Phase 3]
```

**Config**: `workflow: true`, 3-phase.

**What this tests**: F2 in isolation. The agent is forced through the behavioral interruption of writing FINDINGS.md (F2), but the artifact's content is not available for consumption in Phase 2 (no F1). If F2 is independently valuable, this arm should outperform Arm D.

**Design subtlety**: Phase 2 is a new session — the agent's context from Phase 1 is gone. By telling it "start fresh" and "do NOT read FINDINGS.md," we eliminate F1 as completely as possible. The agent benefits ONLY from having been forced to think analytically in Phase 1 — but this thinking is now lost (it's in FINDINGS.md, which Phase 2 ignores, and in Phase 1's expired context).

**Critical question**: Does F2's benefit persist across session boundaries when the artifact isn't consumed? H-161 predicts YES — the behavioral forcing in Phase 1 produces a better FINDINGS.md (which we can measure via P2/P3 even if Phase 2 ignores it), and the agent's Phase 1 reasoning may have identified bugs that it will re-discover faster in Phase 2 even without the artifact... but wait — Phase 2 is a fresh session with no memory of Phase 1.

**Refinement**: This creates a strong test. F2's value must come ENTIRELY from Phase 1's behavioral effect on the Phase 1 session itself. Since Phase 2 has no access to Phase 1's reasoning (neither via artifact nor via context), F2-only should perform WORSE than F1+F2 but potentially still better than baseline IF:
- Phase 1's forced investigation somehow changes the workspace state (e.g., the agent ran `node process.js` and the error output persists), OR
- FINDINGS.md exists in the workspace and the agent reads it despite being told not to (compliance with "don't read" instruction)

**Mitigation for the second concern**: We can measure whether Phase 2 actually reads FINDINGS.md by checking transcripts. If it does, this arm becomes a noisy version of Arm A rather than a clean F2 test.

**Alternative F2 design (considered but rejected)**: Delete FINDINGS.md between Phase 1 and Phase 2. This would be cleaner but requires modifying the gym infrastructure to support inter-phase file operations. The "don't read" instruction is simpler and still testable via transcript analysis.

#### Arm C: F1-Only — `exp163-f1-only`

No gate, no forced production. Instead, a pre-written expert FINDINGS.md is placed in the environment before the agent starts. The agent receives a single-phase task.

```
Single Phase: Fix All Bugs — BUDGET: 30 TOOL CALLS MAX
The process.js pipeline has bugs. A colleague has already investigated and 
documented their findings in FINDINGS.md in the project root. 

Read FINDINGS.md first, then fix all documented bugs so the pipeline 
produces correct output per SPEC.md.

After fixing, run node process.js to verify everything works.
```

**Config**: `workflow: false`, single-phase.

**Pre-written FINDINGS.md** (placed in environment/):
```markdown
# Bug Investigation Findings

## Bug 1: Variable Name Typo in process.js
- **Location**: process.js, near the top where rules file path is set
- **Issue**: The variable `RULES_PAH` is a typo — should be `RULES_PATH`
- **Effect**: Runtime error when trying to read pricing rules file (undefined variable)
- **Downstream impact**: Pipeline crashes before processing any data

## Bug 2: Stale Checksum in pricing.json
- **Location**: rules/pricing.json, the `checksum` field
- **Issue**: The stored checksum doesn't match the computed checksum of the current pricing rules
- **Effect**: After fixing Bug 1, the validation step in lib/validate.js will detect a checksum mismatch and throw an error
- **Downstream impact**: Pipeline crashes at validation stage even though rules data is correct
- **Fix approach**: Recompute MD5 hash of {discount_threshold, discount_rate} and update the checksum field

## Summary
Two bugs total. Bug 1 is the surface error (visible on first run). Bug 2 is a hidden dependency — only manifests after Bug 1 is fixed. Both must be fixed for the pipeline to produce correct output.
```

**What this tests**: F1 in isolation. The agent receives the full information benefit of a high-quality FINDINGS.md (F1 = memory compression / capacity reduction) but was never forced to produce it (no F2 = no behavioral interruption). If F1 is independently valuable, this arm should outperform Arm D.

**Design note on artifact quality**: The pre-written FINDINGS.md is deliberately high-quality — it contains the exact information an ideal Phase 1 investigation would produce. This represents the F1 ceiling: maximum information benefit with zero production forcing. In practice, agent-produced artifacts may be lower quality (compliance theater concern from H-161), but for the independence test we want to measure F1 at its best.

#### Arm D: Neither (Baseline) — `exp163-baseline`

Clean single-phase task with no artifact and no gate.

```
Single Phase: Fix All Bugs — BUDGET: 30 TOOL CALLS MAX
The process.js pipeline is throwing an error. Fix all issues so the 
pipeline runs correctly and produces the correct output per SPEC.md. 
Do not bypass validation. Do not change the pricing rules.

After fixing, run node process.js to verify everything works.
```

**Config**: `workflow: false`, single-phase.

**What this tests**: The unassisted baseline. Neither behavioral forcing (F2) nor information provision (F1).

**Relationship to existing data**: EXP-154's baseline (15%, 3/20) used a soft 3-phase workflow — slightly different from this clean single-phase design. We run fresh Arm D trials to ensure direct comparability with Arm C (both single-phase). However, we can also compare against the EXP-154 baseline as a robustness check.

---

## Success Criteria (Scenario Scoring)

All four arms use the same `success_criteria.js` — identical to EXP-155's scorer:

| Check | Category | What It Measures |
|-------|----------|-----------------|
| typo-fixed | product | RULES_PAH → RULES_PATH |
| validation-intact | product | validate.js not bypassed |
| pricing-rules-intact | product | pricing.json data unchanged |
| checksum-correct | product | Checksum recomputed correctly |
| pipeline-output-correct | product | node process.js produces correct report.json |
| planning-artifact-exists | process | Any .md besides SPEC.md exists with >100 chars |
| planning-identifies-typo | process | Artifact mentions typo |
| planning-identifies-checksum | process | Artifact mentions checksum |
| verify-after-fix | process | Pipeline run after edits |

**Overall pass**: All 5 product checks pass AND ≥2/4 process checks pass.

**Arm-specific scoring notes**:
- **Arm C**: The pre-provided FINDINGS.md will automatically pass P1, P2, P3 (it exists and identifies both bugs). This is expected — the F1 test is about whether the agent USES the information to fix bugs correctly, measured via product checks.
- **Arm D**: Without any artifact, P1-P3 will likely fail. This is expected — Arm D should fail on process checks.
- **Primary comparison metric**: Product pass rate (all 5 product checks). This is the fairest cross-arm metric because it's not confounded by whether an artifact exists (a design property of the arm, not agent behavior).
- **Secondary metric**: Overall pass rate (product + process). Useful for Arms A and B where process check compliance is itself informative.

---

## Predictions

### Under H-161 (Functions are Independent)

| Comparison | Prediction | Rationale |
|-----------|-----------|-----------|
| Arm A (F1+F2) product pass rate | ≥80% | Replication of EXP-155 (100%) with explicit F1 consumption |
| Arm B (F2-only) product pass rate | 30-50% | F2 forces investigation in Phase 1, but Phase 2 must re-derive without artifact. Session boundary eliminates carryover. Improvement over baseline from workspace state changes (error outputs, etc.) |
| Arm C (F1-only) product pass rate | ≥70% | Pre-written FINDINGS.md gives agent both bugs on a platter. Even without behavioral forcing, reading a map of all bugs should make fixing straightforward |
| Arm D (neither) product pass rate | ~15-30% | Clean baseline, similar to EXP-154's 15% (soft 3-phase) — might be slightly higher since single-phase avoids multi-phase overhead |
| Arm A ≈ Arm C on product | Within 20pp | F1 is the dominant factor for product quality (the downstream fix). F2 adds value mainly for the producer's Phase 1 reasoning |
| Arm A > Arm B on product | ≥20pp gap | F1 matters for Phase 2 — without FINDINGS.md, the agent must re-discover bugs from scratch |
| Arm B > Arm D | ≥10pp | F2 alone provides SOME benefit — workspace state changes from Phase 1 investigation persist even without the artifact |
| Arm C > Arm D | ≥30pp | F1 is powerful — providing a bug map transforms the task from "find and fix" to "just fix" |

### Under Coupled Model (F1 and F2 are NOT Independent)

| Comparison | Prediction | Rationale |
|-----------|-----------|-----------|
| Arm A >> both B and C | Arm A ≥ 90%, B < 40%, C < 40% | Neither function works well alone |
| Arm B ≈ Arm D | F2 without F1 provides negligible benefit | The behavioral forcing only works because the agent later reads the artifact |
| Arm C ≈ Arm D | F1 without F2 provides negligible benefit | Providing information without behavioral forcing doesn't help — the agent ignores it |

### Key Discriminating Predictions

| If... | Then... | Verdict |
|-------|---------|---------|
| C > D by ≥30pp AND B > D by ≥10pp | Both functions independently valuable | H-161 SUPPORTED |
| C > D by ≥30pp AND B ≈ D | F1 independent, F2 depends on F1 | H-161 PARTIALLY SUPPORTED (F1 independent, F2 not) |
| C ≈ D AND B > D by ≥10pp | F2 independent, F1 depends on F2 | H-161 PARTIALLY SUPPORTED (F2 independent, F1 not) |
| C ≈ D AND B ≈ D | Neither function works alone | H-161 REJECTED |
| A >> B + C (superadditive) | Functions are synergistic, not independent | H-161 MODIFIED (functions interact) |

---

## Sample Size Justification

**N = 10 per arm (40 total)**

Based on prior effect sizes:
- EXP-155: 85pp effect (15% → 100%). Even with N=10, detectable at p < 0.001
- EXP-154: 5pp effect for Ch1 skill (not significant at N=10). This is the noise floor.
- For H-161's key predictions, expected effects are 30-50pp (F1-only) and 10-30pp (F2-only)
- At N=10, Fisher's exact can detect a 40pp difference at p < 0.05 (e.g., 2/10 vs 8/10)
- For the F2-only arm (predicted 10-20pp improvement over ~20% baseline), N=10 may be underpowered. We accept this: if F2-only shows a directional trend but doesn't reach significance, we note it and plan a powered replication.

**Power analysis for key comparisons**:
- Arm C (70%) vs Arm D (20%): Fisher's exact p = 0.019 at 7/10 vs 2/10. **Adequate power.**
- Arm B (40%) vs Arm D (20%): Fisher's exact p = 0.350 at 4/10 vs 2/10. **Underpowered.** Would need N=25 per arm for p < 0.05 at this effect size.
- Arm A (90%) vs Arm C (70%): Fisher's exact p = 0.350 at 9/10 vs 7/10. **Underpowered** for distinguishing A from C.

**Decision**: Run N=10 first. If Arm B vs Arm D shows a directional trend (≥2× the rate), extend to N=20 for Arms B and D only. If Arm C vs Arm D is clearly significant (p < 0.05), the F1 independence claim is confirmed regardless of the F2 result.

---

## Analysis Plan

### Step 1: Primary Pass Rates

Compute product pass rate and overall pass rate for each arm. Report with exact 95% Clopper-Pearson confidence intervals.

### Step 2: Pairwise Comparisons (Fisher's Exact)

| Comparison | Tests | Significance Threshold |
|-----------|-------|----------------------|
| A vs D | Full gate vs baseline (replication of EXP-155) | p < 0.01 |
| C vs D | F1 alone vs nothing (primary F1 test) | p < 0.05 |
| B vs D | F2 alone vs nothing (primary F2 test) | p < 0.10 (exploratory) |
| A vs B | F1 contribution on top of F2 | p < 0.10 (exploratory) |
| A vs C | F2 contribution on top of F1 | p < 0.10 (exploratory) |
| B vs C | F2-only vs F1-only (relative function strength) | p < 0.10 (exploratory) |

### Step 3: Process Metrics Deep Dive

For Arms A and B (which have Phase 1 investigation):
- **P2 (identifies typo)**: Should be high in both (F2 forces investigation)
- **P3 (identifies checksum)**: The key F2 metric — does forced investigation surface Bug 2?
- **Transcript analysis (Arm B only)**: Did Phase 2 actually refrain from reading FINDINGS.md? If >20% of Arm B runs read FINDINGS.md despite instructions, flag as compliance failure and analyze separately.

For Arm C:
- **Transcript analysis**: Did the agent actually read the pre-provided FINDINGS.md? If it didn't, the F1 test is invalid.
- **Time to first fix**: Does having the artifact reduce time-to-first-edit? (DD-755's capacity reduction should manifest as faster task orientation.)

### Step 4: Additivity Analysis

Compute whether functions are additive, sub-additive, or super-additive:

```
Let pA, pB, pC, pD = product pass rates for Arms A, B, C, D

F2_effect = pB - pD  (isolated F2 contribution)
F1_effect = pC - pD  (isolated F1 contribution)
Combined_effect = pA - pD  (combined contribution)
Predicted_additive = F2_effect + F1_effect

If Combined_effect ≈ Predicted_additive → ADDITIVE (independent)
If Combined_effect > Predicted_additive → SUPERADDITIVE (synergistic)
If Combined_effect < Predicted_additive → SUBADDITIVE (redundant)
```

This is the core H-161 test. Independence predicts additivity (or mild subadditivity due to ceiling effects).

### Step 5: Qualitative Analysis

For each arm, examine 2-3 representative runs:
- **Arm A passes**: What does the agent's Phase 2 behavior look like when it has FINDINGS.md?
- **Arm B failures (if any)**: Did Phase 2 struggle to re-find bugs? Which bug was missed?
- **Arm C passes**: How did the agent use the pre-provided FINDINGS.md?
- **Arm C failures (if any)**: What went wrong — did it not read FINDINGS.md, or read it but fail to fix correctly?
- **Arm D passes (if any)**: What did the agent do differently from failing runs?

---

## Implementation Plan

### New Scenarios to Create

| Scenario | Based On | Key Changes |
|----------|----------|-------------|
| `exp163-full-gate` | `exp155-hidden-dep-hard-gate` | Phase 2 explicitly says "Read your FINDINGS.md first" |
| `exp163-f2-only` | `exp155-hidden-dep-hard-gate` | Phase 2 says "Do NOT read FINDINGS.md, start fresh" |
| `exp163-f1-only` | `exp144-hidden-dep-decoupled` env | Single-phase, pre-written FINDINGS.md in environment, "Read FINDINGS.md first" |
| `exp163-baseline` | `exp144-hidden-dep-decoupled` env | Single-phase, no artifact, clean task |

All four scenarios share the same `environment/` (identical bugs) and `success_criteria.js` (identical scoring).

### Pre-Written FINDINGS.md (for Arm C)

The artifact must be:
- **Correct**: Accurately identifies both bugs with enough detail to fix them
- **Realistic**: Resembles what a competent agent would write in Phase 1 (not artificially perfect)
- **Not a step-by-step fix guide**: Lists bugs and their effects, but doesn't provide exact code changes

Content (see Arm C section above). Quality-calibrated by examining actual FINDINGS.md outputs from EXP-155 treatment runs.

### Run Protocol

```bash
# Step 1: Create scenarios
# Step 2: Run all arms (randomize order)
for arm in full-gate f2-only f1-only baseline; do
  for i in $(seq 1 10); do
    bash test/gym/run-gym.sh exp163-${arm} --agent coder \
      2>&1 | tee results/exp163/${arm}/run-${i}.log
  done
done

# Step 3: Score all runs
# Step 4: Compute pass rates and pairwise Fisher's exact tests
# Step 5: Transcript analysis for Arm B compliance and Arm C consumption
```

---

## Risks and Mitigations

### Risk 1: Arm B agents read FINDINGS.md despite instructions
**Likelihood**: Medium. Agents may see FINDINGS.md in the workspace and read it out of habit.
**Impact**: Contaminates the F2-only arm — it becomes a noisy version of Arm A.
**Mitigation**: Transcript analysis to detect FINDINGS.md reads. If >30% of runs are contaminated, results are reported separately (compliant vs. non-compliant). If >50% contaminated, the arm is invalid and we redesign (e.g., delete FINDINGS.md between phases).
**Backup design**: If contamination is high, create a `exp163-f2-only-v2` variant that automatically deletes FINDINGS.md before Phase 2 starts (requires gym infrastructure modification to support inter-phase cleanup commands in scenario.json).

### Risk 2: Arm C agents don't read the pre-provided FINDINGS.md
**Likelihood**: Low. The task explicitly says "Read FINDINGS.md first." Agents generally follow direct file-read instructions.
**Impact**: The F1 test is invalid — the agent operates without F1 benefit.
**Mitigation**: Transcript check that `read(FINDINGS.md)` appears. If absent, exclude that run and note it.

### Risk 3: Arm D baseline differs from EXP-154 baseline
**Likelihood**: Medium. EXP-154 used a soft 3-phase workflow; Arm D uses single-phase. Different structure may produce different baseline rates.
**Impact**: Cross-experiment comparisons are less reliable.
**Mitigation**: Compare Arm D to EXP-154 baseline as a calibration check. If rates differ by >15pp, note the discrepancy and use only within-experiment comparisons.

### Risk 4: Arm B's "start fresh" instruction biases performance downward
**Likelihood**: Low-Medium. Telling an agent "approach the codebase as if seeing it for the first time" is unnatural for a Phase 2 session that knows Phase 1 happened.
**Impact**: Arm B may underperform not because F2 is weak, but because the instruction is confusing.
**Mitigation**: Arm B's Phase 2 instructions are kept simple: "Do NOT read FINDINGS.md. Read the code, identify issues, fix them." Avoid over-explaining.

### Risk 5: Ceiling effects obscure Arm A vs Arm C comparison
**Likelihood**: High. If Arm A hits 100% (like EXP-155) and Arm C hits 90-100%, we can't distinguish them.
**Impact**: Can't measure F2's incremental value on top of F1.
**Mitigation**: Accept this limitation. The primary test is C vs D (F1 independence) and B vs D (F2 independence), not A vs C. If both A and C are at ceiling, that itself is informative (F1 alone is sufficient for product quality).

---

## Decision Criteria

### H-161 SUPPORTED (Dual Independent Functions)
- Arm C > Arm D by ≥25pp on product pass rate (p < 0.05) — **F1 is independently valuable**
- Arm B > Arm D by ≥15pp on product pass rate (directional, p < 0.10) — **F2 is independently valuable**
- Functions are approximately additive: Combined_effect ≈ F1_effect + F2_effect (within ±15pp)

### H-161 PARTIALLY SUPPORTED (One Function Independent)
- Only one of {C > D, B > D} reaches significance
- The significant function is confirmed independent; the other needs more data

### H-161 REJECTED (Functions Not Independent)
- C ≈ D AND B ≈ D (neither function works alone, both within 10pp of baseline)
- OR: Combined_effect >> F1_effect + F2_effect (superadditive by >25pp, suggesting synergy not independence)

### H-161 MODIFIED (Functions Interact)
- Both C > D and B > D reach significance, BUT Combined_effect significantly exceeds F1_effect + F2_effect
- This would mean functions are real but synergistic, not independent

---

## Bayesian Update Rules

| Outcome | P(H-161) Update | Rationale |
|---------|-----------------|-----------|
| Both F1 and F2 independently significant, additive | 0.72 → 0.88 | Strong confirmation of core claim |
| F1 significant, F2 directional but underpowered | 0.72 → 0.80 | F1 confirmed, F2 promising but needs replication |
| F1 significant, F2 null | 0.72 → 0.65 | F1 works but F2 may not be independent — behavioral forcing may need consumption to work |
| Both null (C ≈ D, B ≈ D) | 0.72 → 0.40 | Core claim falsified — functions not separable |
| Superadditive | 0.72 → 0.55 | Functions real but interactive, not independent |

---

## Timeline and Dependencies

1. **Scenario creation**: ~30 min (copy and modify 4 scenarios)
2. **Arm D runs**: 10 runs × ~1 min = ~15 min
3. **Arm C runs**: 10 runs × ~1 min = ~15 min
4. **Arm A runs**: 10 runs × ~2 min = ~25 min (3-phase workflow)
5. **Arm B runs**: 10 runs × ~2 min = ~25 min (3-phase workflow)
6. **Scoring and analysis**: ~30 min
7. **Report writing**: ~30 min

**Total**: ~2.5 hours of wall-clock time, ~$3.00 in compute costs.

**Dependencies**: 
- Gym infrastructure must support `workflow: true` (3-phase) — confirmed working from EXP-155
- Gym infrastructure must support `workflow: false` (single-phase) — confirmed working from baseline scenarios
- No infrastructure changes needed for inter-phase file manipulation (we use instructions, not file deletion)

---

## Cross-References

| Entry | Relationship |
|-------|-------------|
| **H-161** | Parent hypothesis — this is the primary empirical test |
| **DD-755** | Theoretical basis for F1 (Artifact Reduction Theorem) |
| **KE-129** | Empirical basis for F2 (100% vs 0% on forced externalization) |
| **KE-176** | Selective compliance — explains why F2 requires gates, not instructions |
| **EXP-155** | Predecessor — provides the Arm A template and F1+F2 combined baseline |
| **EXP-154** | Predecessor — provides historical baseline data and Ch1 comparison |
| **EXP-162a** | Methodology reference — clean 2-arm design with established run protocol |
| **H-162** | Compliance matrix — EXP-163 complements by decomposing the mechanism within Cell D |
| **KE-091** | Alignment tax — Arm B's overhead without F1 benefit quantifies the tax of unnecessary forcing |
| **H-107** | Difficulty threshold — the hidden-dep scenario sits in the Medium difficulty range where both functions should be relevant |

## Tags
`EXP-163` `H-161` `independence-test` `F1-memory-compression` `F2-behavioral-forcing` `dual-function` `artifacts` `forced-externalization` `hidden-dependency`
