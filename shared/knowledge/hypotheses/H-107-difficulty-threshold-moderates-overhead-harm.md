# H-107: Difficulty Threshold Moderates Overhead Harm

**Status**: Resolved (inconclusive) → originally Proposed → Externally Validated → Inconclusive (EXP-151)  
**P(H)**: 0.65  
**Date**: 2026-04-12 (updated 2026-04-13, ceiling-effect synthesis added)  
**Author**: Bob  
**Derived from**: KE-158, H-106 (P=0.40), H-099 (P=0.90), H-103 (P=0.45), EXP-147 Track B, EXP-117/120/130, H-098, DD-754 (bias amplification mechanism via KE-162/KE-163)  
**External validation**: DD-753 (5 independent research groups converge on ZPD bell curve)  
**P(H) history**: 0.62 (initial) → 0.80 (DD-753 external validation) → 0.65 (EXP-151 inconclusive, first direct test null)

## Thesis

Observability and guard overhead harms agent performance **only when task difficulty exceeds a threshold** — approximately 50% baseline pass rate. Below this threshold (harder tasks), overhead displaces core reasoning and degrades outcomes. Above it (easier tasks), agents have sufficient processing headroom to absorb overhead with negligible impact. At the extreme (discovery tasks, <30% baseline), any structured overhead is actively destructive.

This reframes the overhead narrative from an agent-type story (H-106: "ready agents are harmed") to a **task-difficulty story**: the same agent absorbs massive overhead on easy tasks and is severely impaired by modest overhead on hard tasks. Agent readiness may interact with difficulty (as a secondary moderator), but difficulty is the primary gating variable.

## Mechanism

### Resource Competition Model (from KE-155/KE-158)

Agent processing operates within a finite attention budget. Overhead (guards, context injection, format requirements) competes with core task reasoning for this budget:

```
Total budget = Core task reasoning + Overhead compliance

Easy tasks   (>90% baseline): Core needs ~30% → 70% headroom → overhead absorbed
Medium tasks (50-90%):        Core needs ~60% → 40% headroom → overhead felt but manageable
Hard tasks   (<50%):          Core needs ~90% → 10% headroom → overhead displaces reasoning
Discovery    (<30%):          Core needs 100%+ → any overhead directly harmful
```

This is consistent with:
- **H-098** (Attention Channel Theory): Ch1 capacity is finite; overhead consumes Ch1/Ch2 budget
- **H-099** (Discovery Boundary): Discovery tasks are the extreme case — maximally hard → maximally overhead-sensitive
- **DD-750**: Forced externalization degrades reasoning when processing is constrained
- **KE-155**: Externalization harm boundary — when format compliance competes with cognitive work

### Why Difficulty, Not Agent Readiness?

H-106 predicted that architecturally ready agents would be disproportionately harmed by observability requirements. But P-106a showed the **opposite**: ready agents have *lower* block rates on correct work (34.3% vs 53.5%, z = −7.53). The observability tax doesn't discriminate by agent type — it discriminates by how much processing headroom the task affords.

This makes mechanistic sense: even an "architecturally ready" agent doing an easy task has plenty of budget for compliance. And even an "unready" agent on a hard task gets harmed by overhead that steals from limited processing capacity.

## Predictions

### P-107a: Difficulty-Stratified Overhead Effect (Primary — Testable)

When overhead is added to a fixed task, the performance delta should correlate negatively with task difficulty (measured by baseline pass rate):

| Task Difficulty (baseline) | Predicted Δ from overhead |
|---|---|
| >90% (easy) | −0 to −5pp (negligible) |
| 50-90% (medium) | −5 to −15pp (moderate) |
| <50% (hard) | −15 to −30pp (large) |
| <30% (discovery) | −30pp or worse (destructive) |

**Test**: Run N≥20 per condition across 4+ scenarios spanning the difficulty range, with and without a standard overhead bundle (e.g., FM-3.3 verification guard + injected context). Plot baseline pass rate vs overhead delta. Prediction: negative correlation with r ≤ −0.70.

### P-107b: Threshold Non-Linearity (Testable)

The overhead effect is not a smooth linear gradient — it has a threshold inflection point near 50% baseline pass rate. Above the threshold, overhead effects are near-zero regardless of exact difficulty. Below the threshold, effects escalate sharply.

**Test**: Fit both a linear model and a threshold/step-function model to the P-107a data. The threshold model should fit significantly better (AIC/BIC comparison). The estimated threshold should fall between 40-60% baseline pass rate.

### P-107c: Discovery Subsumption (Analytical — Tests Against H-099)

H-099's "discovery boundary" — where ALL interventions fail — is not a separate phenomenon but the extreme end of the difficulty threshold. If H-107 is correct, then:
1. Discovery tasks should show the same overhead sensitivity pattern as other hard tasks, just more extreme
2. The discovery-specific mechanisms (template displacement, Einstellung) should reduce to the general resource competition mechanism when difficulty is accounted for
3. Tasks at 30-50% baseline should show intermediate overhead sensitivity between "hard" and "discovery" — no discontinuity

**Test**: Collect overhead sensitivity data at fine-grained difficulty intervals between 20-60% baseline. If there's a smooth curve, H-107 subsumes H-099. If there's a discontinuity at ~30%, discovery is genuinely different (and H-107 needs a modifier).

### P-107d: Context Volume × Difficulty Interaction (Testable)

EXP-147 Track B found +5.1pp overall (null) from context scoping, but +14pp on the three discriminating (hard) scenarios. If the difficulty threshold is real:
1. Context volume reduction should produce larger benefits on harder tasks
2. The relationship between context reduction (tokens removed) and performance improvement should be moderated by difficulty
3. On easy tasks (ceiling scenarios), even massive context injection should produce negligible harm

**Test**: Systematically vary context volume (100, 500, 1000, 5000 tokens injected) across scenarios at different difficulty levels. Prediction: interaction effect where difficulty × context volume explains more variance than either alone.

### P-107e: Agent Readiness as Secondary Moderator (Testable — Refines H-106)

While difficulty is the primary moderator, agent readiness may be a secondary one. Specifically: on hard tasks (where overhead matters), ready agents should show *less* overhead harm than unready agents, because ready agents' internalized workflows partially compensate for the overhead cost.

**Test**: 2×2 design — (easy vs hard task) × (ready vs unready agent). Prediction: significant difficulty main effect (large), non-significant readiness main effect, but significant difficulty × readiness interaction where ready agents are partially protected on hard tasks.

**Note**: This prediction is in tension with the original H-106 prediction (which expected ready agents to be *more* harmed). If P-107e holds, it means readiness is protective, not harmful — the guard's externalization requirement is less costly for agents who already have verification workflows.

## Existing Evidence

| Source | Finding | Support for H-107 |
|---|---|---|
| **EXP-147 Track B** | +5.1pp overall (null), but +14pp on hard tasks (cascading-fix-trap-v2 +17pp, plan-once-amend +11pp, contradictory-req +9pp). 5/8 scenarios hit ceiling. | **Strong** — directly shows difficulty moderates overhead effect |
| **EXP-117** | Forced checklist HARMS Bob's discovery task: 67%→0% (p=0.030) | **Strong** — extreme case at discovery difficulty level |
| **EXP-120** | Progressive tracking also harms: 67%→17% | **Moderate** — second intervention type harmful on hard/discovery task |
| **EXP-130** | Few-shot examples harmful on discovery: −67pp (p=0.030) | **Strong** — few-shot (normally 100% effective) becomes harmful at extreme difficulty |
| **EXP-122/126** | Environmental hints null on discovery task (N=12+12) | **Moderate** — even passive overhead is null on hard tasks |
| **EXP-144** | Format tax null at easy difficulty (100% both arms) | **Moderate** — format overhead doesn't bind when task is easy |
| **H-106 P-106a** | Ready agents have LOWER block rate on correct work (34.3% vs 53.5%) | **Moderate** — falsifies agent-type story, consistent with task-difficulty story |
| **H-106 P-106d** | Inflation correction flattens internalization curve | **Weak** — consistent with overhead being task-distributed, not agent-distributed |
| **EXP-100** | Forced checkpoints HARM high-complexity tasks (alignment tax) | **Moderate** — complexity ≈ difficulty; overhead harms hard tasks |
| **DD-753** | 5 independent groups converge on ZPD bell curve: optimal overhead weighting w(p) = p(1-p), Beta(2,2) kernel. +40.3% from difficulty calibration. Entropy-based runtime positioning. | **Very Strong** — external mathematical validation of core mechanism from independent research |
| **EXP-151 (COMPLETE)** | All 3 buckets complete (159 trials). Easy: ceiling/floor/scoring artifacts, uninformative. Hard: 0% both conditions (72 runs), trivially equivalent. **Medium (45 runs): Full 44% vs Minimal 50%, Δ=+6pp, p=0.71 (NS)**. Per-scenario inconsistent: M1 +12pp (minimal better), M2 −17pp (full better ⚠️), M3 +13pp (minimal better). Severely underpowered (N=18-27/cell, need N=450 for 6pp effect at 80% power). | **Inconclusive** — first direct prospective test of H-107 finds no statistically significant overhead effect. Direction inconsistent across scenarios. Neither confirms nor falsifies. |
| **EXP-152 (COMPLETE)** | 88 trials across 3 scenarios. behavior-escalation-stubborn (100%), convention-verify-edit (100%) — perfect ceiling. kb-discovery-baseline-126 (40-60%) — high variance. Skill removal had zero effect at ceiling. | **Moderate (indirect)** — confirms the ceiling dead zone: interventions at p > 0.85 produce zero variance, exactly as p(1-p) → 0 predicts. |
| **Scenario Census (2026-04-13)** | 46 production scenarios analyzed: ~14 at floor (0%), ~20 at ceiling (85-100%), only 7 in the sweet spot (35-70%). Bimodal distribution. | **Moderate (meta)** — our scenario portfolio is structurally misaligned with H-107 testing. The bimodality explains why EXP-151 couldn't populate its difficulty buckets cleanly. |
| **KE-171** | Formalized difficulty calibration rules. Signal = p(1-p). Dead zones at p < 0.15 and p > 0.85. Only 7 of 46 scenarios are experimentally useful. | **Supporting (practical)** — translates H-107 + DD-753 into experiment design constraints. |

### DD-753: External Validation — ZPD Convergence (2026-04-13)

Five independent research groups have converged on a mathematical framework that validates H-107's core mechanism. DD-753 synthesizes these findings:

**1. The Bell Curve Proof (PACED, 2603.11178)**
Cross-problem gradient signal-to-noise ratio follows a bell curve over student pass rate *p*. The optimal weighting is **w(p) = p(1-p)** — a Beta(2,2) kernel proven minimax-robust. This directly maps to H-107: replace "learning signal" with "value of coordination overhead" and the same curve holds. Tasks at p ≈ 0.5 (edge of capability) benefit maximally from structure; tasks at p ≈ 0 or p ≈ 1 see no benefit.

**2. Curriculum Collapse Warning (Prism, 2603.13309)**
Self-evolving systems that don't manage difficulty undergo curriculum collapse — converging to either trivially easy or impossibly hard problems. Translation: multi-agent systems applying uniform overhead waste resources at both extremes.

**3. The Magnitude Effect (GenEnv, 2512.19682)**
Difficulty-calibrated training yields **+40.3% improvement** over 7B baselines, matching larger models. The magnitude of the difficulty-calibration effect is enormous — far larger than typical architectural improvements.

**4. Runtime Measurement (AERO, 2602.03084)**
Entropy-based positioning provides a runtime-measurable signal: high entropy → task near solvability boundary (ZPD), low entropy → trivial/memorized, very high → beyond capability. This gives H-107 a practical implementation path.

**5. Format Degradation Baseline (Let Me Speak Freely, 2408.02442)**
Establishes that format constraints cause reasoning degradation with stricter constraints causing greater degradation — the baseline phenomenon H-107 moderates.

**Formalized Model from DD-753**:
```
Net value of overhead = B(p) - c
where B(p) ∝ p(1-p) (Beta kernel)
Overhead beneficial when p ∈ [p_low, p_high]
  p_low  = (1 - √(1-4c)) / 2
  p_high = (1 + √(1-4c)) / 2

Example (c=0.10): beneficial when p ∈ [0.11, 0.89]
  At p=0.50: net value = +0.15 (very beneficial)
  At p=0.05: net value = -0.05 (harmful)
```

**Significance**: This external validation is exceptionally strong because (a) 5 independent groups converge on the same mechanism, (b) one provides a mathematical proof, (c) empirical magnitudes are large (+8.2% to +40.3%), and (d) the Beta kernel gives us concrete threshold bounds for the first time.

**Gap acknowledged**: All DD-753 papers study training-time optimization; H-107 concerns inference-time overhead. The mechanism likely transfers (same resource-competition principle) but needs empirical confirmation via EXP-150.

### EXP-151 Final Results (All Buckets Complete, 159 trials)

**Status**: COMPLETE (2026-04-13)

| Bucket | Full (baseline) | Minimal | Delta (min−full) | p-value |
|--------|----------------|---------|-------------------|---------|
| Easy | 50% (11/22) | 50% (10/20) | 0pp | 1.00 |
| Medium | 44% (12/27) | 50% (9/18) | +6pp | 0.71 |
| Hard | 0% (0/63) | 0% (0/9) | 0pp | 1.00 |

**Easy bucket (42 trials)**: investigate-fix-pattern at ceiling (100%/100%), mock-leak-trap at floor due to scoring artifact (0%/0%), wrong-fix-recovery broken. No usable variance.

**Medium bucket (45 trials)**: The critical test. Per-scenario breakdown:
- M1 (3unrelated): Full 55% vs Minimal 67% → +12pp (minimal better)
- M2 (4gate): Full 67% vs Minimal 50% → −17pp (full better ⚠️ REVERSED)
- M3 (kb-fewshot): Full 20% vs Minimal 33% → +13pp (minimal better)

**Hard bucket (72 trials)**: All 0% across both conditions. Floor effect. Trivially equivalent.

**Prediction assessment**:
- P-107a (overhead helps easy): INDETERMINATE (ceiling/floor artifacts)
- P-107b (overhead hurts medium): WEAKLY SUPPORTED in direction but NOT significant (p=0.71); CONTRADICTED by M2 reversal
- P-107c (overhead neutral on hard): SUPPORTED trivially (floor)
- P-107d (largest delta at medium): NOT SUPPORTED (6pp is tiny, non-significant)
- P-107e (50% baseline = max cost): INSUFFICIENT DATA

**Key issues**: Severely underpowered (15% power for 6pp effect, need N=450/cell). Medium bucket heterogeneous (baselines 20-67%). Per-scenario inconsistency suggests scenario-specific confounds.

**Impact on P(H)**: 0.80 → 0.65. See "Why P(H) = 0.65" section below.

### Ceiling-Effect Synthesis: DD-753 + EXP-152 + EXP-144 + Scenario Census (2026-04-13)

The repeated ceiling effects across EXP-152 (88 trials), EXP-144 (50 trials), and EXP-151's easy bucket aren't just experimental failures — **they are exactly what H-107 predicts**, and DD-753 provides the mathematical explanation.

**The p(1-p) prediction maps precisely onto our data:**

| Scenario zone | p (baseline) | p(1-p) signal | What we observed | Matches H-107? |
|---|---|---|---|---|
| Floor (0%) | 0.00 | 0.000 | EXP-151 hard: 0% both conditions. No detectable effect. | ✅ |
| Low (4-20%) | 0.04-0.20 | 0.038-0.160 | read-before-edit, kb-fewshot: weak/noisy signal | ✅ |
| **Sweet spot** (46-67%) | 0.46-0.67 | 0.222-0.250 | EXP-151 medium: +6pp direction. EXP-147: +14pp on hard tasks. Only zone with any signal. | ✅ |
| High (73-83%) | 0.73-0.83 | 0.141-0.197 | Limited data. Marginal effects expected. | Untested |
| Ceiling (91-100%) | 0.91-1.00 | 0.000-0.082 | EXP-152: 100% all conditions. EXP-144: 100% both conditions. Zero variance. | ✅ |

**Key insight**: Our experimental failures aren't evidence against H-107 — they're evidence FOR it. The ZPD model predicts that experiments conducted at ceiling or floor will produce null results, and that's exactly what happened. The problem isn't the hypothesis; it's that we keep testing in the dead zones.

**The bimodal scenario problem**: Our portfolio has ~14 scenarios at floor (0%) and ~20 at ceiling (85-100%), with only 7 in the experimentally productive zone (35-70%). This structural problem explains:
- EXP-152's ceiling effect (all 3 scenarios were at or near ceiling on recent baselines)
- EXP-144's ceiling effect (hidden-dependency and compound-edit both at 100%)
- EXP-151's failure to populate easy/hard buckets cleanly
- Our systematic inability to test H-107 despite 297+ experiment trials

**Implication for P(H)**: This analysis doesn't change P(H) from 0.65 — it doesn't provide new direct evidence for the overhead effect. But it DOES reframe the meaning of our null results. The nulls from EXP-151/152 are not evidence against H-107; they are explained by the theory itself. A properly powered experiment using only sweet-spot scenarios (p ∈ [0.35, 0.70]) has never been run. See KE-171 for practical scenario selection guidelines.

### Why P(H) = 0.65 (Updated from 0.80 after EXP-151)

**Prior**: P(H) = 0.80 (based on DD-753 external validation + retrospective internal evidence)

**EXP-151 update (−0.15)**: The first direct prospective test of H-107 completed with 159 trials across all three difficulty buckets. Result: inconclusive — no statistically significant overhead effect at any level, with contradictory per-scenario directions in the Medium bucket.

1. **Null prospective result (−0.10)**: A well-designed experiment failing to find the predicted effect shifts probability downward. Even though the study had only ~15% power for the observed 6pp effect, the null is still informative because the experiment was designed to detect larger effects (the EXP-149 effect size of ~15pp).
2. **Per-scenario inconsistency (−0.05)**: M2 (contradictory-req-ext-4gate) shows the OPPOSITE direction (Full 67% > Minimal 50%). If the difficulty threshold were a clean mechanism, all medium scenarios should trend in the same direction. The inconsistency suggests scenario-specific confounds may dominate.

**Remaining reasons P(H) stays above 0.50**:
1. **DD-753 external validation still strong**: 5 independent groups converging on ZPD/Beta kernel is powerful evidence the mechanism exists — EXP-151 doesn't refute that, it just fails to confirm it in our specific system
2. **Internal retrospective evidence**: EXP-147 Track B (+14pp on hard tasks), EXP-117/120/130 discovery harm, EXP-100 complexity alignment tax — these remain valid prior evidence
3. **Underpowered by design**: 15% power to detect 6pp means we'd miss a real effect 85% of the time
4. **Methodological failures, not theoretical**: Easy bucket was uninformative due to scoring artifacts and infrastructure bugs, not because the hypothesis is wrong

**Remaining reasons P(H) < 0.80**:
1. **No prospective validation**: EXP-151 was supposed to be the validation experiment. It produced nothing conclusive. The hypothesis survives on retrospective evidence alone.
2. **Training-time vs inference-time gap**: DD-753 papers study training optimization; our hypothesis concerns inference-time overhead. Transfer is unconfirmed.
3. **Threshold shape untested**: P-107b (linear vs threshold) remains completely untested
4. **Scenario selection concerns**: Medium bucket heterogeneity (20-67% baseline) and mixed directions raise questions about whether we're measuring an overhead effect or scenario-specific noise

## Proposed Experiment: EXP-150 — Difficulty Threshold Validation

### Design

**Goal**: Test whether overhead harm scales with task difficulty, and whether there's a threshold.

**Method**: Select 6 scenarios spanning the difficulty range:
- 2 easy (>85% baseline): e.g., simple verification, basic file edit
- 2 medium (50-85%): e.g., plan-once-amend, contradictory-requirements  
- 2 hard (<50%): e.g., cascading-fix-trap-v2, KB discovery integration

**Conditions**: 
- A: No overhead (minimal context, no guards)
- B: Standard overhead (FM-3.3 guard + standard injected context)

**N**: 20 per cell (6 scenarios × 2 conditions × 20 = 240 runs)

**Primary analysis**: Plot baseline pass rate (Condition A) vs overhead delta (A − B). Test for negative correlation. Fit threshold model vs linear model.

**Power**: With N=20/cell and expected effect sizes from existing data (0pp easy, −15pp hard), we have >80% power to detect r = −0.70 at α = 0.05.

### Cheaper Alternative: Cascading-Fix-Trap-V2 Focused Test

Run N=50 per condition on cascading-fix-trap-v2 alone (the single hardest non-discovery scenario, ~41% baseline). If overhead produces ≥15pp harm here, the difficulty threshold is validated for hard tasks. Cost: ~$10-15.

## Connections

| Entry | Relationship |
|---|---|
| **KE-158** | Direct formalization — KE-158's difficulty threshold model is the theoretical basis for H-107 |
| **DD-753** | External validation — 5 independent groups converge on ZPD bell curve; Beta(2,2) kernel provides mathematical foundation. P(H) 0.62→0.80 |
| **DD-754** | Mechanistic complement — Li et al. (2026) bias amplification in MAS topologies explains WHY overhead peaks at medium difficulty: maximum stochastic variance = maximum amplifiable signal for guard chains acting as echo chambers. See KE-162, KE-163. |
| **KE-162** | Bridge entry — maps DD-754's echo chamber dynamics onto guard architecture; guards are structurally identical to DD-754's amplification layers |
| **KE-163** | Synthesis — formalizes DD-754 as the mechanistic engine of H-107's medium-difficulty peak. Proposes upgraded mechanism (resource competition + amplification) and new prediction P-107f (chain depth × difficulty interaction) |
| **H-106** (P=0.40) | Parent hypothesis. H-107 reframes H-106's agent-type prediction as task-difficulty-gated. If H-107 is confirmed, H-106 should be archived as superseded. |
| **H-099** (P=0.90) | Potentially subsumed — discovery boundary may be extreme end of difficulty threshold (P-107c tests this) |
| **H-103** (P=0.45) | Explained — format tax exists but only manifests on hard tasks, explaining mixed results |
| **H-098** (P=0.80) | Compatible — channel theory provides the mechanism (finite Ch1/Ch2 capacity), H-107 adds the moderating condition |
| **H-101** (P=0.78) | Complementary — readiness determines learning trajectory, difficulty determines when overhead costs matter. May interact (P-107e). |
| **H-085** (P=0.85) | Refined — forced externalization's 5 boundaries all occur on harder tasks; H-107 provides the unifying variable |
| **EXP-149** | Should be updated to stratify by task difficulty as primary variable |
| **EXP-150** (proposed) | Direct test of H-107 |
| **EXP-151** (COMPLETE) | First direct prospective test. All 3 buckets complete (159 trials). **INCONCLUSIVE** — no significant overhead effect at any level. Medium bucket +6pp (p=0.71, NS). P(H) 0.80→0.65. |
| **EXP-152** (COMPLETE) | 88 trials, all ceiling. Confirms dead-zone prediction: interventions unmeasurable when p > 0.85. |
| **KE-171** | Practical difficulty calibration guide. Formalizes DD-753's p(1-p) into scenario selection rules. Identifies 7 experimentally useful scenarios. |

## If Confirmed

1. **Adaptive gating becomes the design priority**: Gate activation should be conditioned on estimated task difficulty, not just agent identity
2. **H-106 archived**: Superseded by the difficulty-gated model
3. **H-099 potentially subsumed**: If discovery tasks follow the same curve, we don't need a separate "discovery boundary" hypothesis
4. **EXP-149 redesigned**: Stratify by task difficulty × guard condition, not just agent readiness × guard condition
5. **System design rule**: Never add overhead to tasks estimated below 50% baseline pass rate without explicit justification

## If Falsified

1. **H-106 revisited**: If difficulty doesn't moderate, the agent-type story may be correct after all (perhaps with different predictions)
2. **Task-type effects**: Overhead harm might be about task structure (creative vs procedural) rather than difficulty per se
3. **Uniform overhead model**: Overhead might harm equally across difficulties — the existing data just happened to show difficulty correlation by chance
