# Deep Dive: arXiv:2603.05485 — "Towards Provably Unbiased LLM Judges via Bias-Bounded Evaluation"

**Authors:** Benjamin Feuer (Stanford/Oumi.AI), Lucas Rosenblatt (NYU), Oussama Elachqar (Oumi.AI)
**Date:** March 5, 2026
**Code:** https://github.com/penfever/bias-bounded-evaluation

---

## Paper Summary

The paper introduces **Average Bias-Boundedness (A-BB)**, an algorithmic framework that provides formal, provable guarantees that measurable biases in LLM judges will have bounded impact on evaluation outcomes. The core insight: rather than trying to enumerate and eliminate every possible bias source, guarantee that *any bias pattern of sufficient magnitude will be indistinguishable from noise*.

The mechanism is inspired by differential privacy but adapted for LLM evaluation: measure how sensitive a judge is to contextual perturbations (formatting changes, rubric schema deviations, etc.), then inject precisely calibrated Gaussian noise to drown out that sensitivity — while retaining as much ranking signal as possible.

**Key result:** On Arena-Hard-Auto with 4 LLM judges, they achieve (τ=0.5, δ=0.01) bias-bounded guarantees while retaining 61–99% correlation with original rankings across bias settings (most >80%).

---

## Core Technical Framework

### 1. Formal Definitions

- **Judgment Space (𝒥):** Vector of scores per rubric factor + overall score: j = (s₁, s₂, ..., sₖ, s_overall)
- **Bias Space (ℬ):** Space of all systematic deviations from ideal judgment based on factors not in the rubric
- **Judgment Context (D):** Dataset of prompt-response pairs + environmental factors (order, formatting, etc.)
- **Neighboring Contexts (D ~ D'):** Two contexts differing in exactly one bias-introducing perturbation that preserves semantic content

### 2. Average Bias-Boundedness (A-BB) — The Core Mechanism

**Why not worst-case?** Standard differential privacy bounds against *any* perturbation across *any* neighboring dataset — too conservative for LLM evaluation, where we control both judge and application setting.

**A-BB instead:** Fix a judgment context D. Define a randomized **neighbor generator** T that produces perturbed versions D' = T(D). A mechanism M is **(τ, δ)-average bias-bounded** if:

> Pr[‖M(D) − M(D')‖₂ > τ] ≤ δ

where probability is over both the neighbor generator T and the mechanism's internal randomness.

**Translation:** With probability ≥ (1−δ), any bias-induced perturbation changes the output scores by at most τ.

### 3. The Algorithm (Algorithm 1)

```
Input: Base judge f, context D, neighbor generator T, params (τ, δ)
Output: (τ, δ)-average bias-bounded judgment j'

1. Compute raw judgment j = f(D)
2. Estimate RMS sensitivity:
   - Sample m neighbors D'₁, ..., D'ₘ from T(D)
   - Δ₂*(f,D) = √(1/m · Σᵢ ‖f(D) − f(D'ᵢ)‖²₂)
3. Split failure budget: δ_B = δ/2, δ_Δ = δ/2
4. Verify: τ > Δ₂*(f,D) · √(2/δ)
5. Compute max admissible noise:
   σ_max = (τ − Δ₂*(f,D)·√(2/δ)) / √(2(d + 2√(d·log(2/δ)) + 2·log(2/δ)))
6. Sample noise Z ~ 𝒩(0, σ²·Iₐ)
7. Return j' = j + Z
```

### 4. Lipschitz Shrinkage (Key Practical Enhancement)

Before adding noise, apply a **deterministic Lipschitz contraction** g(x) = αx + (1−α)μ where α ∈ (0,1]:
- Contracts all neighbor-to-neighbor score differences by factor α
- Reduces effective sensitivity: Δ₂*(g∘f, D) ≤ α · Δ₂*(f, D)
- Allows **less noise** for the same (τ, δ) guarantee
- Trades small utility loss for much tighter bias certificates

**Center μ strategies:** Fixed/public centers (profile means), holdout means, EMA centers frozen per batch.

### 5. Sensitivity Measurement — Three Bias Types

| Bias Type | How Measured | Typical Magnitude |
|-----------|-------------|-------------------|
| **Formatting sensitivity** | Generate semantic paraphrases of responses, measure score variance | Large, high variance across judges |
| **Schematic adherence** | Fit polynomial regression of overall score on per-factor scores; S_sch = √(1 − R²_schematic) | Very large (R² ranges 0.10–0.74 across judges) |
| **Inherent jitter** | Run same judgment 5 times, compute RMS across runs | Baseline variance |

**Combination strategies:**
- **Conservative:** S = max(S_fmt, S_psy, S_sch) — safest, most noise
- **RMS:** S = √((S²_fmt + S²_psy + S²_sch)/3) — used in experiments

### 6. Coverage of Unknown Biases (Critical Property)

Set B = max over all measured generators of Δ₂*(f, D; Tᵢ). This conservative calibration:
- Certifies against the worst measured bias
- **Also covers any unknown bias whose RMS sensitivity ≤ B**
- Covers any convex mixture of measured biases
- Trades more shrinkage/noise for coverage guarantee

---

## Comparison with "Trust or Escalate" (Closest Prior Work)

| Property | Trust or Escalate | A-BB |
|----------|:--:|:--:|
| Guarantees on all evaluations | ✗ | ✓ |
| Handles unknown biases | ✗ | ~✓ (if RMS bounded by measured) |
| No human labels required | ✗ | ✓ |
| General scoring (beyond pairwise) | ✗ | ✓ |
| Bounds bias impact directly | ✗ | ✓ |
| Human agreement guarantee | ✓ | ~✓ (combinable with conformal prediction) |
| Selective abstention | ✓ | ✗ |

---

## Limitations (As Stated by Authors)

1. **No absolute accuracy claims** — bounds bias impact, not calibration quality
2. **Finite-sample sensitivity estimation** — empirical Δ₂* from m samples may underestimate true sensitivity; could exceed δ in practice
3. **Bias must be measurable** — a bias generator T must exist to calibrate against it
4. **Preferences are also bias** — A-BB dampens all systematic patterns, including legitimate signal; works best when intrinsic jitter and systematic bias are weak
5. **Local guarantee** — certified for the specific context D and generator T, not a distributional generalization

---

## Applicable Techniques for Our Evaluator Agent

### Technique 1: Sensitivity-Calibrated Scoring ⭐⭐⭐

**What:** Before finalizing evaluation scores, measure sensitivity by running the same evaluation with perturbed inputs (reformatted agent transcripts, reordered sections, paraphrased task descriptions). Use the observed variance to calibrate confidence in the scores.

**How to implement:**
- When evaluator scores an agent session, generate 2–3 paraphrased/reformatted versions of the transcript
- Re-score each version
- If scores diverge significantly → widen confidence intervals, flag as low-confidence evaluation
- If scores are stable → the evaluation is robust

**Cost:** 3–4× judge calls per evaluation. Use selectively on high-stakes or borderline cases.

### Technique 2: Lipschitz Shrinkage for Score Compression ⭐⭐⭐

**What:** Apply affine shrinkage g(x) = αx + (1−α)μ to raw scores before reporting. This compresses extreme scores toward a center, reducing the impact of any single bias source.

**How to implement:**
- Set μ = rolling mean of historical scores for that agent
- Set α = 0.7–0.9 (tunable: lower α = more compression = more bias resistance, less discrimination)
- Raw score 0.95 with μ=0.7, α=0.8 becomes: 0.8 × 0.95 + 0.2 × 0.7 = 0.90
- Raw score 0.3 with same params becomes: 0.8 × 0.3 + 0.2 × 0.7 = 0.38

**Effect:** Extreme evaluations (both positive and negative) are moderated. Prevents the evaluator from being "captured" by a single impressive or terrible session.

### Technique 3: Conservative Envelope for Multi-Bias Coverage ⭐⭐

**What:** When measuring evaluator bias, measure multiple dimensions (formatting sensitivity, ordering sensitivity, length bias) and use B = max(all measured sensitivities) as the calibration target.

**How to implement:**
- Periodically run evaluator on known-good transcripts with:
  - Section order permuted
  - Verbose vs. concise reformulations  
  - With/without tool call results
- Measure sensitivity per dimension
- Use the *worst* dimension's sensitivity as the overall bias bound

**Effect:** Even unknown biases are bounded as long as they're no worse than the worst measured one.

### Technique 4: Schematic Adherence Auditing ⭐⭐

**What:** Measure how well the evaluator's overall verdict can be predicted from its per-rubric scores. Low R² = the evaluator is being influenced by factors outside the stated rubric.

**How to implement:**
- Collect historical evaluations with per-agent scores (efficiency, quality) and overall verdicts
- Fit regression: verdict ~ f(efficiency scores, quality scores)
- If R² is low (< 0.6) → the evaluator is using unstated criteria (potential bias source)
- Track R² over time as a meta-health metric

**Effect:** Detects evaluator "mood" or "drift" — when the overall verdict stops tracking the rubric.

### Technique 5: Gaussian Noise Injection for Borderline Cases ⭐

**What:** For evaluations near decision boundaries (e.g., quality = 0.68–0.72, straddling the "good" threshold), inject small calibrated noise and re-evaluate to test stability.

**How to implement:**
- If raw score is within ±0.05 of a verdict boundary:
  - Add noise ε ~ 𝒩(0, σ²) where σ is calibrated to measured sensitivity
  - If verdict flips under noise → flag as "borderline, low confidence"
  - Report both the raw score and the confidence band

**Effect:** Prevents brittle threshold decisions. "Good" at 0.71 vs "acceptable" at 0.69 should be flagged as uncertain, not presented as confident.

### Technique 6: Neighbor Generator as Adversarial Testing ⭐⭐

**What:** The paper's "neighbor generator" concept directly maps to adversarial testing of our evaluator. Create systematic perturbations that *should not* change the evaluation but might.

**Perturbation catalog for our evaluator:**
- **Order bias:** Present agent sessions in different orders in the transcript
- **Format bias:** Restructure tool call outputs (JSON vs. prose summaries)
- **Length bias:** Compress or expand transcript while preserving content
- **Framing bias:** Change neutral task descriptions to positive/negative framing
- **Name bias:** Swap agent names to detect name→expectation associations

**Effect:** Builds a quantitative bias profile for our evaluator agent, enabling calibrated trust.

---

## Architecture-Level Insight

The paper's deepest applicable insight is the **philosophical reframing**: rather than trying to make the evaluator perfectly unbiased (impossible), accept that bias exists and **bound its impact algorithmically**. This aligns with our system's existing adversarial verification pattern (bug-hunt's Hunter/Skeptic/Referee):

1. **Evaluator scores** (potentially biased)
2. **Sensitivity measurement** quantifies how biased
3. **Shrinkage + noise** bounds the impact of that bias
4. **Meta-monitoring** (schematic adherence) detects drift

The A-BB guarantee — *with probability ≥ (1−δ), bias changes scores by at most τ* — is exactly the kind of hard-gated assurance our SIGNALS.md flagged as needed for "Incorrect Verification."

---

## Concrete Next Steps

1. **Immediate:** Add sensitivity testing to evaluator — run 2 format-perturbed versions of borderline evaluations
2. **Short-term:** Implement Lipschitz shrinkage with rolling historical means as centers
3. **Short-term:** Build schematic adherence metric (R² of verdict vs. rubric scores) as evaluator health check
4. **Medium-term:** Build perturbation catalog (order, format, length, framing, name) for systematic evaluator bias profiling
5. **Medium-term:** Implement conservative envelope calibration against worst-measured bias dimension
6. **Long-term:** Full A-BB pipeline with Gaussian noise for formal (τ, δ) certificates on high-stakes evaluations
