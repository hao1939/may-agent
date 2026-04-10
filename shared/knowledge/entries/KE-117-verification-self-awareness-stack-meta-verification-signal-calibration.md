# KE-117: Verification Self-Awareness Stack — Meta-Verification, Signal Calibration, and Cold-Start Recovery

**Rating**: ★★★★★
**Created**: 2026-04-10 by Bob
**Sources**: DD-724 (Co-Sight CAMV, ★★★★★), DD-725 (DeepVerifier rubric verification, ★★★★★), DD-726 (Calibrated Uncertainty for PRMs, ★★★★½), CR-330 (Verification Self-Awareness Gap synthesis)
**Builds on**: KE-105 (Verification Orchestration Stack), KE-116 (Next-Gen Evaluation Architecture)
**Connected hypotheses**: H-096 (Evaluation Architecture Determines Quality Ceiling), H-093 (CIVC)
**Updates**: KE-098 (Uncertainty-Aware Verification Signals), KE-104 (Complete Verification Architecture)

---

## The Problem: Verification Doesn't Know When It's Wrong

Our verification system has a **self-awareness gap**: it produces verdicts but has no mechanism for detecting when those verdicts themselves are unreliable. Three specific failures:

1. **Uncalibrated scores**: A verification score of 0.85 has no probabilistic meaning. It could be systematically over-confident (EXP-102: 100% confabulation rate despite high confidence) or under-confident (KE-112: recovery mechanism works but scores are conservative).

2. **No meta-verification**: When a verifier says "PASS," nothing checks whether the verifier made an error. Single-point-of-failure verification is structurally fragile. Our 35% FM-3.3 residual (H-096) includes cases where verification itself fails.

3. **Cold-start blindness**: New task types get the same verification depth and thresholds as established ones, despite having no calibration history. This either wastes compute (over-verifying easy tasks) or misses failures (under-verifying novel tasks).

Three recent papers (DD-724, DD-725, DD-726) provide complementary solutions that together close 3 of the 5 remaining gaps identified in KE-105.

---

## The Verification Self-Awareness Stack

Building on KE-105's four-layer orchestration and KE-116's evaluation architecture, the self-awareness stack adds two new layers:

```
┌──────────────────────────────────────────────────────────┐
│  Layer 6: META-VERIFICATION (DD-724 Co-Sight CAMV)       │
│  Inter-verifier conflict detection + confidence-weighted │
│  resolution. Disagreement = signal, not noise.           │
├──────────────────────────────────────────────────────────┤
│  Layer 5.5: SIGNAL CALIBRATION (DD-725 + DD-726)         │
│  Rubric decomposition → sub-scores → post-hoc           │
│  calibration → probabilistically meaningful verdicts     │
├──────────────────────────────────────────────────────────┤
│  Layer 5: Skill Evolution (KE-116 Layer 4)               │
│  SkillClaw collective evolution, trajectory features     │
├──────────────────────────────────────────────────────────┤
│  Layer 4: Adaptive Rubrics (KE-116 Layer 3)              │
│  AdaRubric task-adaptive evaluation + DAF                │
├──────────────────────────────────────────────────────────┤
│  Layer 3: Budget Allocation (KE-105 Layer 3)             │
│  DOVA deliberation-first + risk triage                   │
├──────────────────────────────────────────────────────────┤
│  Layer 2: Runtime Enforcement (KE-105 Layer 2)           │
│  Sentinel agents, inline monitors                        │
├──────────────────────────────────────────────────────────┤
│  Layer 1: Policy Compilation (KE-105 Layer 1)            │
│  Semantic Router DSL → static guarantees                 │
└──────────────────────────────────────────────────────────┘
```

### What's new (this entry):
- **Layer 6 (Meta-Verification)**: Does not trust any single verifier. Runs overlapping checks with diverse verification strategies and treats disagreement as an actionable signal requiring resolution — not an error to suppress.
- **Layer 5.5 (Signal Calibration)**: Transforms raw scores into calibrated probabilities via two complementary mechanisms: structural decomposition (rubrics) and statistical post-hoc mapping (isotonic regression).

---

## Three Core Mechanisms

### Mechanism 1: Conflict-Aware Meta-Verification (DD-724, Co-Sight)

Co-Sight's CAMV (Conflict-Aware Meta-Verification) treats the output of multiple verifiers as a first-class signal:

**Architecture**: Multiple verification agents independently assess the same claim using overlapping but non-identical methods. A meta-verifier detects disagreements across their outputs.

**Resolution protocol**:
1. **Agreement** → Aggregate with confidence weighting → proceed
2. **Disagreement** → Trigger deep re-verification on the specific conflicted dimension
3. **Persistent disagreement** → Flag for human review with structured conflict report

**Key numbers**: Co-Sight achieved 84.4% accuracy on GAIA (SOTA at time of publication), primarily by detecting and resolving cases where individual verifiers produced contradictory assessments.

**Our mapping**: Currently, commit guard runs a single verification pass. CAMV says: run 2-3 diverse verification strategies (structural check, rubric-based evaluation, adversarial probe), and use disagreement as a signal. This directly addresses our 14.6% "confident failure" problem (H-096) — confident failures are precisely cases where a single verifier was wrong and nothing caught it.

**Critical insight from DD-724**: The overlapping coverage requirement means verifiers MUST use different methods, not just different prompts. Prompt diversity alone is insufficient — methodological diversity (structural vs. semantic vs. adversarial) is what creates genuine conflict detection.

### Mechanism 2: Rubric-Decomposed Verification (DD-725, DeepVerifier)

DeepVerifier replaces holistic "is this correct?" verification with structured rubric-based evaluation:

**Architecture**:
1. **Failure taxonomy** → 5 categories, 13 sub-categories of reasoning errors
2. **Task-specific rubric generation** → Select relevant categories, generate criteria, weight by task type
3. **Multi-dimensional verification** → Each rubric dimension evaluated independently
4. **Self-evolving rubrics** → When dimensions disagree, refine the rubric and re-verify

**Key numbers**: 12-48% improvement over standard LLM-as-Judge. Rubric evolution converges in 2-4 iterations.

**Our mapping**: For commit guard, instead of "is this commit good?", ask:
- (a) Does the implementation match task requirements? (completeness)
- (b) Are there logical errors in business logic? (correctness)
- (c) Does this regress existing functionality? (regression risk)
- (d) Does the commit misunderstand codebase architecture? (context awareness)
- (e) Are tests adequate for the changes? (test coverage)
- (f) Are API assumptions correct? (integration risk)

Each dimension is independently assessable and independently calibratable. The composite verdict becomes interpretable — "rejected because of dimension (d), architecture misunderstanding" rather than "rejected, score 0.42."

**Self-evolution connection**: When dimensions (a) and (d) disagree (implementation looks complete but architecture is wrong), the rubric refines to ask more specifically about the architecture-implementation alignment. This is inference-time compute scaling applied to verification quality, not just verification speed.

### Mechanism 3: Statistical Signal Calibration (DD-726)

DD-726 provides the statistical foundation for making verification scores probabilistically meaningful:

**Core finding**: Raw LLM confidence is badly miscalibrated — typical Expected Calibration Error (ECE) is 15-25%. Post-hoc calibration via isotonic regression reduces ECE to 2-5%.

**Process-level vs. outcome-level**: Calibrating per-step rather than per-trajectory is both more tractable and more informative. It tells you WHERE the uncertainty is, not just how much exists.

**Critical warning — verbalized confidence is unreliable**: Models saying "I'm 90% sure" are often wrong far more than 10% of the time. DD-681 (from our existing research) confirmed this mechanistically: the Reasoning Contamination Effect makes verbalized confidence and actual accuracy orthogonal in representation space. **System policy: never use raw model-expressed confidence as a decision signal.**

**Calibration methods** (ranked by suitability for our system):
1. **Isotonic regression** (recommended): Non-parametric, flexible, needs ~100-500 (score, outcome) pairs
2. **Conformal prediction** (for cold-start): Produces prediction sets with formal coverage guarantees
3. **Platt scaling**: Simple logistic regression, works but less flexible than isotonic
4. **Temperature scaling**: Token-level only, doesn't apply to rubric scores

**Our mapping**: Between the commit guard's raw scores and the accept/reject decision, add a calibration layer trained on historical (guard-score, production-outcome) pairs. This transforms "score = 0.85" into "P(correct) = 0.73 based on historical calibration" — an actually meaningful probability.

---

## How the Three Mechanisms Compose

The mechanisms aren't alternatives — they're layers in a pipeline:

```
Commit/Task Output
    ↓
[Layer 5.5a: Rubric Generation] ← DD-725
    Generate task-adaptive rubric (5-7 dimensions)
    ↓
[Layer 5.5b: Multi-Dimensional Verification]
    Each dimension evaluated independently
    ↓
[Layer 5.5c: Intra-Verifier Consistency] ← DD-725
    Dimensions agree? → Aggregate
    Dimensions disagree? → Self-evolve rubric, re-verify
    ↓
[Layer 5.5d: Calibration] ← DD-726
    Raw sub-scores → calibrated probabilities
    (isotonic regression on historical outcomes)
    ↓
[Layer 6a: Multi-Verifier Execution] ← DD-724
    Run 2-3 diverse verification strategies
    ↓
[Layer 6b: Inter-Verifier Conflict Detection] ← DD-724
    Verifiers agree? → Confidence-weighted aggregate
    Verifiers disagree? → Flag conflict, deep re-verification
    ↓
Calibrated, Meta-Verified Verdict
```

### Three Operating Modes

**Mode A: Routine verification** (most commits)
- Single rubric-based verification pass (Layer 5.5a-d)
- Calibrated score above threshold → PASS
- Cost: ~1.5× current verification (rubric overhead)

**Mode B: Uncertain verification** (calibrated score near threshold)
- Rubric-based verification detects dimensional disagreement OR calibrated score in uncertain zone
- Trigger CAMV: run second diverse verifier
- Conflict? → Deep re-verification on conflicted dimension
- Cost: ~3-4× current verification

**Mode C: Cold-start verification** (new task type, no calibration history)
- DeepVerifier generates rubrics from first principles (zero-shot)
- Conformal prediction produces wide prediction sets (conservative)
- Treat all scores as low-confidence until ~100-500 outcomes accumulated
- Cost: ~2× current verification (conservative overhead)

---

## Gap Closure Status (KE-105)

| KE-105 Gap | Status | Solution | Evidence |
|------------|--------|----------|----------|
| Signal calibration | ✅ **CLOSED** | DD-725 rubric decomposition + DD-726 isotonic regression | ECE 15-25% → 2-5%; +12-48% verification accuracy |
| Verification of verifiers | ✅ **CLOSED** | DD-724 CAMV conflict-aware meta-verification | 84.4% GAIA SOTA via conflict detection |
| Cold-start | ✅ **CLOSED** | DD-726 conformal prediction + DD-725 zero-shot rubrics | Protocol defined; ~100-500 examples to steady state |
| Dynamic capability profiles | ❌ **OPEN** | Possible via SkillClaw (DD-722) extension to individual agents | No direct solution yet |
| Multi-step attack detection | ❌ **OPEN** | Requires sequential anomaly detection literature | No strong leads |

**Net effect**: KE-105 goes from 5 open gaps to 2. The 3 closed gaps (calibration, meta-verification, cold-start) are the ones most directly connected to our production failure modes (confabulation, confident failures, verification collapse).

---

## Connection to H-096 (Evaluation Architecture Quality Ceiling)

H-096 identifies three architectural ceilings on verification quality:
1. **Trajectory-level eval degrades 24pp** on long horizons (DD-720)
2. **Narrative judgment enables confabulation** (DD-721, EXP-102)
3. **Fixed rubrics allow dimensional masking** (DD-723)

The Verification Self-Awareness Stack addresses all three:
- **Ceiling 1**: Rubric decomposition (DD-725) provides checkpoint-level evaluation, avoiding trajectory-level degradation
- **Ceiling 2**: Meta-verification (DD-724) catches confabulation through multi-verifier disagreement
- **Ceiling 3**: Self-evolving rubrics (DD-725) prevent dimensional masking by adapting rubric structure to each task

This doesn't mean H-096's predicted 35% FM-3.3 residual drops to 0% — but it provides the architectural mechanisms to push through the ceiling. Estimated residual with full stack: **15-25%** (roughly halving current failures), based on Co-Sight's SOTA improvements and DeepVerifier's +12-48% verification accuracy gains.

---

## Connection to H-093 (CIVC) and KE-112/113

CIVC (Complexity-Induced Verification Collapse) describes verification degrading as task complexity increases. The self-awareness stack provides three countermeasures:

1. **Calibration detects CIVC onset**: As complexity increases, calibrated confidence will drop — this is a measurable signal. Currently we detect CIVC only post-hoc (via FM-3.3 assignment). Calibrated process-level scores enable real-time detection.

2. **Meta-verification catches verification theater**: CIVC's most dangerous form is "verification theater" (FM-3.3b) — the agent appears to verify but doesn't actually check. CAMV catches this because a genuine verifier will disagree with a theatrical one.

3. **Budget allocation responds to uncertainty**: With calibrated scores, DOVA-style budget allocation (KE-105 Layer 3) can automatically increase verification depth on complex tasks where CIVC risk is highest.

KE-113's key finding (commit guard is recovery, not prevention) is compatible: the self-awareness stack makes the recovery mechanism more reliable by calibrating when recovery is needed and meta-verifying the recovery attempt itself.

---

## Practical Implementation Path

### Phase 1: Rubric Decomposition (Low cost, immediate value)
- Replace holistic commit guard with 5-7 dimension rubric evaluation
- Each dimension gets explicit criteria and failure modes
- No calibration needed — interpretability alone improves override rate
- **Prerequisite**: Define commit-type taxonomy (bug-fix, refactor, feature, config)
- **Expected impact**: P-330a — reduced Hao override rate due to specific, addressable feedback

### Phase 2: Calibration Layer (Medium cost, requires outcome data)
- Implement (prediction, outcome) logging for all verification decisions
- After ~100-500 examples per task type, train isotonic regression calibration
- Transform raw scores into calibrated probabilities
- **Prerequisite**: Production outcome tracking (what CR-326 called the "feedback loop")
- **Expected impact**: P-330b — 30-50% verification budget reduction on high-confidence commits

### Phase 3: Meta-Verification (Higher cost, highest value)
- Run dual verification on uncertain commits (calibrated score in [0.3, 0.7] zone)
- Use methodologically diverse verifiers (structural + semantic + adversarial)
- CAMV conflict detection triggers deep re-verification
- **Prerequisite**: Phases 1 and 2 operational
- **Expected impact**: P-330c — catch verification failures invisible to single verifiers

### Phase 4: Cold-Start Protocol (Enables scaling)
- Conformal prediction sets for new task types
- Conservative defaults until calibration history accumulates
- Transfer calibration from similar task types as prior
- **Prerequisite**: Calibration infrastructure from Phase 2
- **Expected impact**: Safe onboarding of new agents and task types

---

## Key Design Principle: Never Trust Verbalized Confidence

This principle emerges from the convergence of three independent evidence streams:

1. **DD-726**: Verbalized confidence has 20-40% gap from actual accuracy. ECE for verbalized confidence is dramatically worse than for structured scoring methods.

2. **DD-681** (from our KB): Reasoning Contamination Effect — calibration and verbalized confidence are ORTHOGONAL in representation space. This is not a calibration problem — it's a fundamental mechanistic disconnect.

3. **EXP-101**: Our own production data — HVR (Hedge-Verify Ratio) AUROC of 0.535, essentially random. Agent hedging patterns don't predict failure.

**System policy**: All confidence scores must come from structured verification (rubric dimensions, structured checks) and must pass through post-hoc calibration. Agent self-reported confidence (e.g., "I'm confident this is correct") should be logged for research but never used as a decision input.

---

## Predictions

### P-117a: Rubric Decomposition Improves Verification Accuracy ≥15%
**Claim**: Replacing holistic commit guard evaluation with rubric-decomposed evaluation will improve verification accuracy by ≥15% on a held-out test set of commits.
**Basis**: DeepVerifier showed +12-48% improvement; our system likely at lower end due to domain transfer. Conservative estimate: ≥15%.
**Test**: EXP-115 (proposed by H-096) — A/B test of holistic vs. rubric-based guard on gym scenarios.

### P-117b: Calibrated Scores Will Show Current Guard Is Over-Confident
**Claim**: When we calibrate current guard scores against production outcomes, the calibration curve will show systematic over-confidence (scores of 0.8 mapping to actual accuracy of ~0.6).
**Basis**: DD-726 shows 15-25% ECE for uncalibrated LLM verification; EXP-102 showed 100% confabulation despite apparent confidence.
**Test**: Retrospective calibration analysis once outcome tracking is implemented.

### P-117c: Meta-Verification Catches 10-20% of Verification Failures
**Claim**: Running CAMV-style dual verification on commits where current single verification passes will reveal 10-20% of those passes are incorrect.
**Basis**: Co-Sight caught enough verification errors to achieve GAIA SOTA. Our confident failure rate (H-096) is 14.6%, suggesting substantial room for meta-verification to find errors.
**Test**: Retrospective dual-verification on historical commits with known outcomes.

### P-117d: Cold-Start Protocol Reduces New-Task-Type Failure Rate by ≥30%
**Claim**: Implementing conservative-default cold-start protocol (conformal prediction + zero-shot rubrics) will reduce failure rate on the first 100 tasks of a new type by ≥30% compared to using established thresholds.
**Basis**: DD-726 shows cold-start blindness is a major calibration failure mode. Conservative defaults avoid the over-confidence trap.
**Test**: Next time a new agent or task type is introduced, A/B test cold-start protocol vs. standard verification.

---

## Relationship to Existing Knowledge Entries

| Entry | Relationship |
|-------|-------------|
| **KE-105** (Verification Orchestration Stack) | KE-117 extends KE-105 with two new layers (5.5 and 6), closing 3 of 5 gaps |
| **KE-116** (Next-Gen Evaluation Architecture) | KE-117 provides the self-awareness layers that sit above KE-116's evaluation stack |
| **KE-104** (Complete Verification Architecture) | KE-117 adds meta-verification and calibration to KE-104's evidence grounding pipeline |
| **KE-098** (Uncertainty-Aware Verification Signals) | KE-117 provides the calibration infrastructure that makes KE-098's signals actionable |
| **KE-097** (Confirmation Bias Mechanism) | CAMV meta-verification is a structural counter to confirmation bias — diverse verifiers are less likely to share the same bias |
| **KE-099** (Adversarial Framing Bypass) | Adversarial framing could serve as one of the methodologically diverse verification strategies in CAMV |
| **KE-100** (Machine-Verified Evidence Injection) | Machine-verified evidence is a calibration anchor — it provides ground truth that rubric dimensions can be calibrated against |
| **KE-113** (Commit Guard Recovery) | Self-awareness stack makes recovery mechanism more reliable by meta-verifying recovery attempts |

---

## Rating Justification: ★★★★★

1. **Closes critical KE-105 gaps**: 3 of 5 remaining gaps addressed with concrete mechanisms
2. **Directly addresses production failures**: 14.6% confident failures (H-096), 100% confabulation (EXP-102), 35% FM-3.3 residual — all connected to verification self-awareness deficits
3. **Strong empirical grounding**: GAIA SOTA (DD-724), +12-48% verification (DD-725), ECE 15-25%→2-5% (DD-726)
4. **Composable architecture**: Three mechanisms layer cleanly on existing KE-105/KE-116 stack
5. **Actionable implementation path**: Phase 1 (rubric decomposition) can start immediately with no infrastructure prerequisites
6. **Establishes system policy**: "Never trust verbalized confidence" is immediately applicable, supported by 3 independent evidence streams

---

*Bob KE#117 | 2026-04-10 | Session s_1775810620064_41 | Synthesizes DD-724/725/726 + CR-330*
