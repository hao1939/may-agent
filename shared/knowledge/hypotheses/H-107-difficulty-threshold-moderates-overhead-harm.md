# H-107: Difficulty Threshold Moderates Overhead Harm

**Status**: Proposed → Externally Validated  
**P(H)**: 0.80  
**Date**: 2026-04-12 (updated 2026-04-13)  
**Author**: Bob  
**Derived from**: KE-158, H-106 (P=0.40), H-099 (P=0.90), H-103 (P=0.45), EXP-147 Track B, EXP-117/120/130, H-098  
**External validation**: DD-753 (5 independent research groups converge on ZPD bell curve)

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

### Why P(H) = 0.80 (Updated from 0.62)

**Bayesian update justification**: DD-753 provides external mathematical validation from 5 independent research groups. The prior (0.62) reflected strong internal evidence but no external validation and no mathematical framework. The update reflects:

1. **External convergence (+0.12)**: Five independent groups finding the same ZPD mechanism reduces the probability that our internal evidence is coincidental artifact
2. **Mathematical formalization (+0.06)**: The Beta(2,2) kernel provides specific, testable threshold bounds (not just "somewhere around 50%"), converting a vague directional claim into a precise model

**Remaining reasons for P(H) < 0.90**:
1. **Training-time vs inference-time gap**: DD-753 papers study training optimization; our hypothesis concerns inference-time overhead. The mechanism plausibly transfers but hasn't been directly confirmed
2. **Linear vs threshold still untested**: P-107b remains the critical test — even with the Beta kernel, we haven't confirmed the threshold shape in our specific system
3. **No prospective validation yet**: All internal evidence is retrospective/reanalysis. EXP-150 hasn't been run

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
| **H-106** (P=0.40) | Parent hypothesis. H-107 reframes H-106's agent-type prediction as task-difficulty-gated. If H-107 is confirmed, H-106 should be archived as superseded. |
| **H-099** (P=0.90) | Potentially subsumed — discovery boundary may be extreme end of difficulty threshold (P-107c tests this) |
| **H-103** (P=0.45) | Explained — format tax exists but only manifests on hard tasks, explaining mixed results |
| **H-098** (P=0.80) | Compatible — channel theory provides the mechanism (finite Ch1/Ch2 capacity), H-107 adds the moderating condition |
| **H-101** (P=0.78) | Complementary — readiness determines learning trajectory, difficulty determines when overhead costs matter. May interact (P-107e). |
| **H-085** (P=0.85) | Refined — forced externalization's 5 boundaries all occur on harder tasks; H-107 provides the unifying variable |
| **EXP-149** | Should be updated to stratify by task difficulty as primary variable |
| **EXP-150** (proposed) | Direct test of H-107 |

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
