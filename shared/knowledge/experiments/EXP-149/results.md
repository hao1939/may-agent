# EXP-149 Results: Observability Tax on Architecturally Ready Agents

**Status:** COMPLETE — Data-Only Phase (P-106a, P-106d)  
**Hypothesis:** H-106 (Observability Tax Harms Architecturally Ready Agents)  
**Analyst:** Coach  
**Date:** 2026-04-12  
**Data sources:** `.state/guard-breakdown-strict.json` (2,476 sessions, Apr 6–11), `guard-impact-analysis-20260411.md`  
**Analysis file:** `agents/coach/workspace/h106-prediction-test-results.md`

---

## 1. What Was Tested

EXP-149 was designed as a three-condition A/B test (Full Guards / Outcome-Only / No Guards). The full experimental intervention was not run. Instead, two predictions were testable with existing observational data:

| Prediction | Test Method |
|-----------|------------|
| **P-106a**: Ready agents have higher guard block rate among correct-deliverable sessions | Observational comparison: learner vs reliant block rates on sessions rated "good" quality |
| **P-106d**: Inflation correction steepens internalization curve for ready agents | Re-analysis of EXP-135 data with EXP-136 inflation corrections applied |

Remaining predictions P-106b (outcome-based guard design) and P-106c (thinking trace evidence) require experimental interventions not yet available.

---

## 2. P-106a: Guard Fire Rate Asymmetry — NOT SUPPORTED

### Prediction
> Ready agents should have a **higher** block rate among correct-deliverable sessions, because the guard penalizes invisible-but-real verification.

### Result: Opposite Direction

| Group | Blocked-Good Sessions | Total Good Sessions | Block Rate | 95% CI |
|-------|----------------------|--------------------|-----------:|--------|
| **Learner** (bob, coach, TL) | 309 | 901 | **34.3%** | [31.3%, 37.5%] |
| **Reliant** (may, scout, optimizer) | 345 | 645 | **53.5%** | [49.6%, 57.3%] |

**Difference:** Learner − Reliant = **−19.2 pp** (opposite of predicted direction)  
**z = −7.53**, p(one-sided) > 0.999, p(two-sided) < 0.0001  
**Cohen's h = −0.389** (medium effect, wrong sign)

### Per-Agent Detail (Inflation-Corrected)

| Agent | Group | Block Rate Among Correct Work | 95% CI |
|-------|-------|-----------------------------:|--------|
| bob | learner | 41.6% | [36.4%, 47.0%] |
| coach | learner | 35.1% | [30.3%, 40.2%] |
| tech-lead | learner | 21.8% | [16.7%, 27.8%] |
| may | reliant | 68.2% | [61.5%, 74.2%] |
| scout | reliant | 64.4% | [57.6%, 70.7%] |
| optimizer | reliant | 31.6% | [26.0%, 37.8%] |

### Interpretation

Ready agents have internalized **both** verification skill **and** the externalization format the guard expects. Their correct work passes the guard more often, not less. Reliant agents produce correct work but fail to produce the specific evidence format the guard requires — the guard catches a real FORMAT gap, not invisible competence.

**Verdict: Strong falsification of P-106a.**

---

## 3. P-106d: Tax-Adjusted Internalization Curve — NOT SUPPORTED

### Prediction
> Removing inflation-corrected (tax) blocks should reveal **steeper** internalization for ready agents — the tax was masking genuine improvement.

### Result: Correction Flattens the Curve

**Heartbeat-only data (most controlled task type):**

| Group | Metric | Period A (Apr 6) | Period D (Apr 11) | OLS Slope |
|-------|--------|:----------------:|:-----------------:|:---------:|
| Learner | Raw | 52.8% | 14.3% | −0.132 |
| Learner | **Corrected** | 39.9% | 12.1% | **−0.096** |
| Reliant | Raw | 22.2% | 66.7% | +0.158 |
| Reliant | Corrected | 22.2% | 66.2% | +0.157 |

**All-task aggregate data:**

| Group | Metric | Apr 6 | Apr 11 | OLS Slope |
|-------|--------|:-----:|:------:|:---------:|
| Learner | Raw | 30% | 50% | +0.047 |
| Learner | **Corrected** | 22% | 41% | **+0.019** |

### Why Correction Flattens Instead of Steepens

Tax blocks are proportional to total blocks (inflation rate × block count). Early periods have more blocks, so they have more inflated blocks in absolute terms. Removing tax lowers early rates more than late rates → flatter curve.

**Bob example (heartbeats):**
- Period A: 72% raw → 40% corrected (−32 pp removed)
- Period D: 10% raw → 5% corrected (−5 pp removed)
- Raw improvement = 62 pp. Corrected improvement = 35 pp.

About **half** of the apparent improvement in EXP-135's raw data was tax blocks disappearing as the base rate dropped, not genuine behavioral change.

### Key Finding

The bifurcation (learners improve, reliants degrade) **survives correction robustly** — all 3 learners still have negative slopes, all 3 reliants still have positive slopes. But the magnitude of learner improvement is reduced by ~30%.

**Verdict: Moderate falsification of P-106d. The tax inflates apparent improvement, not apparent stagnation.**

---

## 4. Novel Finding: Tax Direction Is Inverted

The most important result is not the prediction failures but what they reveal:

| H-106 Predicted | Observed |
|----------------|----------|
| Tax masks improvement (both start and end rates include tax) | Tax **inflates** apparent improvement (more tax in early periods) |
| Ready agents penalized for invisible competence | Ready agents internalized both skill and compliance format |
| Guard is pure overhead for ready agents | Guard catches real format gaps in reliant agents |

The observability tax is real (EXP-136 confirmed 20% inflation), but its **direction** is opposite to H-106's model. Tax blocks are not uniformly distributed — they concentrate where block rates are already high, which means they amplify apparent trends rather than suppressing them.

---

## 5. Posterior Update for H-106

### Prior: P(H) = 0.65

### Evidence Summary

| Evidence | Direction | Weight |
|----------|-----------|--------|
| P-106a: Ready agents have LOWER block rate among correct work (z = −7.53) | **Against** | Strong |
| P-106d: Tax inflates apparent improvement, not masks it | **Against** | Moderate |
| Theoretical mechanism (DD-750, KE-155) still coherent | For | Moderate |
| EXP-136 inflation is real (20% overall) | For | Weak |
| Bifurcation survives correction (H-101 confirmed) | Neutral | — |

### Posterior: P(H) = 0.40

**Rationale for 0.40 (not lower):**
1. Theoretical foundation (DD-750 externalization harm) remains sound — the mechanism may exist but manifest differently than predicted
2. P-106b (outcome-based guards) and P-106c (thinking traces) remain untested — the tax could operate in modes not captured by P-106a/P-106d
3. Discovery tasks (H-099) are absent from this data — the tax may specifically target creative/exploratory work, not routine verification
4. Bob IS guard-harmed (−6.1 pp quality impact from guard-impact-analysis) — there's real evidence that guards can harm ready agents, even if the specific mechanism H-106 proposed is wrong

**Why it drops from 0.65:** Two of four testable predictions fail definitively. The core claim — that ready agents are penalized for invisible competence — is contradicted by the data showing ready agents produce visible competence.

---

## 6. Implications

### For Guard Policy
- **No change warranted based on H-106 alone.** The tax-as-penalty theory doesn't hold.
- **Bob's guard-harm finding (from guard-impact-analysis) stands independently** of H-106 and warrants separate investigation. Bob's −6.1 pp quality degradation when blocked may be a workflow-disruption effect (deliver-or-report being interrupted), not an observability tax effect.
- **Reliant agents' high false-block rate (53.5% on correct work)** suggests guard FORMAT should be adapted, not guard EXISTENCE.

### For Future Experiments
- P-106b (outcome-based guards) is now the most promising remaining prediction — it addresses the format gap directly
- P-106c (thinking traces) requires EXP-146 infrastructure (currently blocked)
- A new hypothesis may be needed: **guards harm via workflow disruption** (Bob's case), not via observability tax

### For EXP-135
- Inflation correction reduces apparent learner improvement by ~30% but does not change the qualitative finding (bifurcation is real)
- **Corrected** learner slopes should be used as ground truth going forward

---

## 7. Limitations

1. **Observational only** — no experimental manipulation of guard conditions (Conditions B and C from design were not run)
2. **6-day window** — short time series limits trend analysis statistical power
3. **Quality ratings** from guard-impact-analysis, not independently verified
4. **Inflation rates** from EXP-136 git-commit heuristics may not capture all forms of inflation
5. **Active recall/context confounds** not controlled between agent groups
6. **All-task aggregate** shows both groups escalating (positive slopes) — the heartbeat-only analysis is more favorable but has small per-cell n

---

## 8. Status of H-106 Predictions

| Prediction | Status | Result |
|-----------|--------|--------|
| P-106a | ✅ Tested | **Not supported** — opposite direction (z = −7.53) |
| P-106b | ⬜ Untested | Requires outcome-based guard experiment |
| P-106c | ⬜ Untested | Requires thinking traces (EXP-146 blocked) |
| P-106d | ✅ Tested | **Not supported** — correction flattens curve |

**Overall H-106 Status:** Partially tested; 2/4 predictions falsified. P(H) reduced from 0.65 to 0.40.


[SIG: {{SIG}}]
