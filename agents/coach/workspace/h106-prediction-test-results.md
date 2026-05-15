# H-106 Prediction Tests: P-106a and P-106d Results

**Date**: 2026-04-12
**Analyst**: Coach
**Hypothesis**: H-106 (Observability Tax Harms Architecturally Ready Agents)
**Data sources**: `.state/guard-breakdown-strict.json` (2,476 sessions, Apr 6-11), `guard-impact-analysis-20260411.md` (quality data)
**Method**: Statistical hypothesis testing with EXP-136 inflation correction

---

## Executive Summary

**P-106a: NOT SUPPORTED** (z = −7.53, p > 0.99, opposite direction)
**P-106d: NOT SUPPORTED** (correction flattens, not steepens, internalization curve)

Both predictions of H-106 fail empirical testing. The observability tax mechanism, while theoretically coherent, does not manifest in the ways H-106 predicted. A novel finding emerges: the tax inflates *apparent* improvement, not apparent stagnation.

---

## 1. P-106a: Guard Fire Rate Asymmetry

### Prediction
> "Among agents who actually verify correctly (true positives of verification quality), architecturally ready agents should have a **higher guard block rate** than unready agents."

The claim: ready agents verify but don't externalize, so the guard penalizes invisible-but-real verification.

### Method

1. Used quality evaluation data from `guard-impact-analysis-20260411.md` (1,127 sessions with quality verdicts)
2. For each agent, computed:
   - Blocked sessions rated "good" quality (deliverables were correct)
   - Unblocked sessions rated "good" quality
   - Inflated blocks reclassified using EXP-136 inflation rates
3. Calculated: **block rate among correct-deliverable sessions** per group

**Agent classification** (from EXP-135 bifurcation analysis):
- Learner agents (architecturally ready): bob, coach, tech-lead
- Reliant agents (architecturally unready): may, scout, optimizer

**EXP-136 inflation rates**: bob 45.3%, coach 8.0%, tech-lead 3.4%, may 0%, scout 0%, optimizer 3.2%

### Results

#### Per-Agent Block Rate Among Correct-Deliverable Sessions (Inflation-Corrected)

| Agent | Group | Blocked-Good | Total-Good | Block Rate | 95% CI |
|-------|-------|-------------|-----------|-----------|--------|
| bob | learner | 137 | 330 | 41.6% | [36.4%, 47.0%] |
| coach | learner | 125 | 357 | 35.1% | [30.3%, 40.2%] |
| tech-lead | learner | 46 | 213 | 21.8% | [16.7%, 27.8%] |
| may | reliant | 139 | 204 | 68.2% | [61.5%, 74.2%] |
| scout | reliant | 131 | 203 | 64.4% | [57.6%, 70.7%] |
| optimizer | reliant | 75 | 238 | 31.6% | [26.0%, 37.8%] |

#### Group-Level Comparison

| Group | Blocked-Good | Total-Good | Block Rate | 95% CI |
|-------|-------------|-----------|-----------|--------|
| Learner | 309 | 901 | 34.3% | [31.3%, 37.5%] |
| Reliant | 345 | 645 | 53.5% | [49.6%, 57.3%] |

**Difference**: Learner − Reliant = **−19.2pp** (opposite of prediction)

#### Statistical Test

Two-proportion z-test (H₁: Learner > Reliant, one-sided):
- **z = −7.532**
- **p (one-sided) > 0.999** — cannot reject null in predicted direction
- **p (two-sided) < 0.0001** — the groups differ, but in the opposite direction
- **Cohen's h = −0.389** (medium effect size, wrong sign)

### Interpretation

**P-106a is definitively NOT supported.** The data shows the opposite: reliant agents have a *higher* block rate among correct-deliverable sessions (53.5% vs 34.3%). The CIs don't overlap. The effect is large and unambiguous.

Why? The observability tax theory predicts that ready agents get blocked *despite* correct work because they don't externalize. But the data shows that ready agents' correct work is *less likely* to be blocked than reliant agents' correct work. This is consistent with an alternative explanation: **ready agents have internalized both verification AND externalization** — their correct sessions include visible evidence that satisfies the guard.

The reliant agents (may at 68%, scout at 64%) are blocked even when their work is correct because they haven't learned to produce the specific evidence format the guard expects. The guard is catching a real FORMAT gap, not taxing invisible competence.

---

## 2. P-106d: Tax-Adjusted Internalization Curve

### Prediction
> "Once tax blocks are removed (per EXP-136 inflation methodology), the genuine internalization rate for ready agents should be even steeper than the raw data suggests."

The claim: inflated blocks mask genuine improvement; removing them reveals faster internalization.

### Method A: Aggregate Daily Rates (All Task Types)

Computed per-day FM-3.3 block rates for learner and reliant groups, with and without EXP-136 inflation correction.

| Group | Metric | Apr 6 | Apr 7 | Apr 8 | Apr 9 | Apr 10 | Apr 11 | OLS Slope (±SE) |
|-------|--------|-------|-------|-------|-------|--------|--------|----------------|
| Learner | Raw | 30% | 31% | 25% | 36% | 42% | 50% | +0.047 ± 0.024 |
| Learner | Corrected | 22% | 24% | 19% | 27% | 32% | 41% | +0.019 ± 0.015 |
| Reliant | Raw | 28% | 38% | 51% | 69% | 69% | 72% | +0.099 ± 0.016 |
| Reliant | Corrected | 28% | 38% | 50% | 69% | 69% | 72% | +0.097 ± 0.016 |

**Aggregate result**: Both groups ESCALATE (positive slopes). Correction reduces learner slope from +0.047 to +0.019, but it remains positive. The correction does NOT reveal hidden internalization — it reveals that escalation was slower than it appeared.

### Method B: Heartbeat-Only Data (From EXP-135)

Heartbeats are the most controlled task type. Using EXP-135's per-period per-agent data:

| Group | Metric | Period A (Apr 6) | Period B (Apr 7-8) | Period C (Apr 9-10) | Period D (Apr 11) | OLS Slope |
|-------|--------|------------------|-------------------|---------------------|-------------------|-----------|
| Learner | Raw | 52.8% | 26.9% | 10.0% | 14.3% | −0.132 |
| Learner | Corrected | 39.9% | 21.3% | 8.5% | 12.1% | −0.096 |
| Reliant | Raw | 22.2% | 42.4% | 67.1% | 66.7% | +0.158 |
| Reliant | Corrected | 22.2% | 42.3% | 66.7% | 66.2% | +0.157 |

**Heartbeat result**: Learner slope is NEGATIVE (genuine internalization), but correction makes it **LESS steep** (−0.096 vs −0.132). This is the **opposite** of P-106d's prediction.

### Why Correction Flattens (Not Steepens) Internalization

The inflation correction removes more blocks from early periods (when block rates are high) than late periods (when block rates are low, because the agent improved). This is mathematically inevitable:

**Bob example (heartbeats)**:
- Period A: 13/18 raw → 7.1/18 corrected (removed 5.9 inflated blocks)
- Period D: 2/21 raw → 1.1/21 corrected (removed 0.9 inflated blocks)
- Raw improvement: 72% → 10% = −62pp
- Corrected improvement: 40% → 5% = −35pp

The tax blocks were concentrated when block rates were highest. Removing them lowers the *starting point* more than the *ending point*, revealing that **genuine improvement was about half as dramatic as the raw data suggested**.

### Corrected Learner Slope Significance Test

Corrected heartbeat slope = −0.096, SE = 0.036, df = 2:
- t = −2.67 (approaching significance but df too small for confidence)
- With 4 data points, cannot achieve conventional significance

### Per-Agent Corrected Slopes (Heartbeats)

| Agent | Group | Period A → D | Corrected Slope | Direction |
|-------|-------|-------------|-----------------|-----------|
| bob | learner | 40% → 5% | −0.115 | ↓ Improving |
| coach | learner | 51% → 22% | −0.099 | ↓ Improving |
| tech-lead | learner | 28% → 9% | −0.072 | ↓ Improving |
| may | reliant | 39% → 71% | +0.141 | ↑ Degrading |
| optimizer | reliant | 16% → 51% | +0.117 | ↑ Degrading |
| scout | reliant | 11% → 76% | +0.212 | ↑ Degrading |

The bifurcation holds robustly under correction: all learners improve, all reliants degrade.

### P-106d Verdict

**NOT SUPPORTED.** The correction flattens internalization curves rather than steepening them. The observability tax inflates the *starting point* of the curve, making raw improvement look more dramatic than genuine improvement. This is a novel finding that **inverts** H-106's prediction about the tax's directional effect.

---

## 3. Novel Finding: The Tax Inflates Apparent Improvement

The most important finding is not the prediction failures, but what they reveal about the tax mechanism:

**H-106 predicted**: Tax masks improvement (starting and ending rates look similar because both contain tax)
**Observed**: Tax inflates improvement (starting rate has more tax than ending rate, making the decline look bigger than it is)

This is because:
1. Tax blocks are proportional to total blocks (inflation rate × block count)
2. Early periods have more blocks (before internalization)
3. Therefore early periods have more inflated blocks in absolute terms
4. Removing tax lowers early rates more → flatter curve → less dramatic improvement

**Implication**: EXP-135's raw learner improvement (bob 72% → 10%) overstates genuine behavioral change. The corrected curve (bob 40% → 5%) shows that about half of the apparent improvement was just tax blocks disappearing as the base rate dropped.

---

## 4. Impact on H-106

### Predictions Tested

| Prediction | Result | Evidence Strength |
|-----------|--------|------------------|
| P-106a (Guard fire rate asymmetry) | **Not supported** (opposite direction, p < 0.0001) | Strong falsification |
| P-106d (Tax-adjusted internalization curve) | **Not supported** (correction flattens, not steepens) | Moderate falsification |

### H-106 P(H) Update

| Factor | Direction | Weight |
|--------|-----------|--------|
| P-106a falsified — ready agents have LOWER not higher block rate among correct work | Against H-106 | Strong |
| P-106d falsified — tax inflates apparent improvement, doesn't mask it | Against H-106 | Moderate |
| Theoretical mechanism (DD-750, KE-155) still coherent | Supports H-106 | Moderate |
| EXP-136 inflation is real (20% overall) | Supports H-106 | Weak |
| Bifurcation robustly survives correction | Neutral (supports H-101, not H-106 specifically) |  |

**Recommended P(H) revision**: 0.65 → **0.40**

The two testable predictions both fail. The theoretical mechanism may still be real in principle, but the specific manifestation H-106 describes (ready agents penalized for invisible competence) is not observed in data. Ready agents appear to have internalized BOTH the skill AND the externalization format, which is why they have lower block rates.

The residual 0.40 probability reflects that:
- The theoretical foundation remains sound (DD-750)
- The tax mechanism may operate in ways not captured by P-106a/P-106d (e.g., on discovery tasks per H-099, which aren't in our data)
- Only 2 of 4 predictions tested (P-106b, P-106c still untested)

---

## 5. Connections

- **H-101** (Bifurcation): Confirmed. Learner/reliant split survives inflation correction.
- **H-102** (Workflow Adoption): The finding that ready agents externalize effectively suggests they adopted the compliance *format*, supporting H-102's mechanism.
- **EXP-135**: Heartbeat-only analysis validated. Corrected slopes tell the same story (learners improve, reliants degrade) but with reduced magnitude.
- **EXP-136**: Inflation rates used as correction factors. The methodology works but the directional prediction was wrong.
- **EXP-137** (May's Paradox): May's 68% block rate among correct work is not "tax" — it's genuine format non-compliance. May produces correct output but doesn't produce the evidence format the guard expects.

---

## 6. Limitations

1. **Quality data is from guard-impact-analysis (Apr 11)**, not independently verified. Quality ratings may have their own biases.
2. **Inflation rates are from EXP-136** which used git-commit heuristics. These may not capture all forms of inflation or genuine blocks.
3. **Only 6 days of data** — short time series makes trend analysis low-powered.
4. **Heartbeat-only analysis has small per-period n** per agent (~18-97 per cell), leading to noisy estimates.
5. **P-106b and P-106c remain untested** — these require experimental intervention (outcome-based guard, thinking traces) not available in observational data.
6. **Active recall / context confounds**: The analysis doesn't control for differences in active_recall content between agent groups.

---

## Tags
`H-106`, `observability-tax`, `guard-analysis`, `P-106a`, `P-106d`, `inflation-correction`, `bifurcation`, `falsification`
