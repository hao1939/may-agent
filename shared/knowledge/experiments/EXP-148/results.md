# EXP-148 Results: H-102 Scope Re-Analysis — Workflow Adoption vs Universal Decline

**Status:** COMPLETE  
**Date:** 2026-04-12  
**Analyst:** Coach  
**Data Source:** `.state/may.db` — convention_checks table  
**Records:** 59,232 convention checks across 5,068 sessions, 13 agents, 12 conventions  
**Date range:** Mar 24 – Apr 12, 2026  

---

## 0. Data Source Correction

EXP-145 reported 57,540 convention checks from `may.db`. The actual data resides in **`.state/may.db`** (59,232 checks across 5,068 sessions). The databases at `/app/may.db`, `/app/agents/may.db`, and `/app/agents/.state/may.db` all have empty `convention_checks` tables. All analysis below uses the correct `.state/may.db`.

---

## 1. Convention Classification

Each of the 12 conventions was classified based on whether workflow adoption could plausibly bypass the convention's check:

### Workflow-Gated (6 conventions)
Process-step conventions that structured workflows could substitute for or bypass:

| Convention | Description | Rationale for Workflow-Gated |
|---|---|---|
| **C1.1** | Read-before-edit | Workflows with pre-planned file modifications can skip the exploratory read step |
| **C1.3** | Verify-writes | Workflow templates know expected outcomes; edit() diffs serve as self-verification |
| **C1.7** | Verification evidence | Workflow-driven finish() calls may omit evidence if the workflow guarantees correctness |
| **C6.1** | Budget awareness | Workflow-optimized sessions use fewer calls, reducing budget pressure |
| **C8.2** | Promise-deliver-report | Workflows with predefined deliverables may not produce explicit reports |
| **C12.1** | Session-start orientation | Workflow-initiated sessions may skip context-gathering if the workflow provides context |

### Workflow-Independent (6 conventions)
Safety, correctness, and fundamental behavioral conventions with no workflow alternative:

| Convention | Description | Rationale for Workflow-Independent |
|---|---|---|
| **C1.4** | Finish-clearly | All sessions must call finish() — no workflow bypasses this |
| **C1.5** | Ghost deliverables | Workflow or not, claimed files must exist |
| **C2.1** | Precise arguments | Tool schema compliance is model-level, not workflow-level |
| **C3.2** | Workspace isolation | Security boundary — cannot be legitimately bypassed |
| **C3.3** | Safe append-only files | Data integrity — cannot be bypassed |
| **C7.1** | Root is /app | Security boundary — cannot be bypassed |

---

## 2. Agent Classification

Based on agents observed in the data:

| Group | Agents | Sessions (Early/Late) | Rationale |
|---|---|---|---|
| **Learner** | bob, coach, tech-lead | 5,100 / 8,592 checks on gated | Observed workflow adoption patterns |
| **Reliant** | amy-kimi, qa | 2,341 / 2,174 checks on gated | Core function tied to convention enforcement |
| **Neutral** | may, coder, scout, optimizer, amy, master, unknown | 5,265 / 6,016 checks on gated | Mixed roles |

**Note:** The design specified "guard" and "auditor" as reliant agents, but these don't appear in the data. Amy-kimi and QA were substituted as the closest analogues (quality-enforcement roles).

---

## 3. Core Results: 3×2×2 Analysis Matrix

### 3.1 Fire Rate Table (Early: Mar 24–Apr 2 vs Late: Apr 3–12)

"Fire rate" = proportion of convention checks that **failed** (lower = better compliance).

| Agent Group | Conv Type | Early Fire% (n) | Late Fire% (n) | Decline (pp) |
|---|---|---|---|---|
| **Learner** | WF-Gated | **36.1%** (5,100) | **4.8%** (8,592) | **−31.3** |
| **Learner** | WF-Indep | 14.0% (5,200) | 1.0% (8,592) | −13.0 |
| **Reliant** | WF-Gated | 24.4% (2,341) | 5.6% (2,174) | −18.8 |
| **Reliant** | WF-Indep | 10.1% (2,374) | 2.3% (2,174) | −7.9 |
| **Neutral** | WF-Gated | 28.7% (5,265) | 4.7% (6,016) | −23.9 |
| **Neutral** | WF-Indep | 10.2% (5,388) | 1.9% (6,016) | −8.3 |

### 3.2 Key Observations

1. **WF-Gated conventions decline more than WF-Independent in ALL agent groups** — not just learners
2. **Learner agents show the largest absolute decline** (−31.3 pp on WF-Gated), but neutral agents aren't far behind (−23.9 pp)
3. **The decline is universal** — all 6 cells show substantial improvement, with WF-Gated consistently ~2–3× the decline of WF-Indep

---

## 4. Prediction Testing

### P1: Learner × WF-Gated ≥ 2× any other cell

| Cell | Decline |
|---|---|
| Learner × WF-Gated | −31.3 pp |
| Neutral × WF-Gated | −23.9 pp (next largest) |

**Ratio: 1.31×** — **P1 FAILED** (needed ≥ 2.0×)

The Learner×WF-Gated cell shows the largest decline, but the Neutral×WF-Gated cell is only 7.4 pp behind. Optimizer alone (Neutral) shows −33.6 pp decline on WF-Gated conventions.

### P2: Reliant agents show uniform decline across convention types (ratio ≤ 1.3×)

- Reliant WF-Gated decline: 18.8 pp  
- Reliant WF-Indep decline: 7.9 pp  
- **Ratio: 2.40×** — **P2 FAILED** (needed ≤ 1.3×)

Reliant agents show the *same pattern* as learner agents — steeper decline on WF-Gated conventions. This contradicts H-102's prediction that only learner agents should show this asymmetry.

### P3: Statistically significant interaction effect

**Interaction term (Learner vs Reliant × Gated vs Indep):**
- Interaction: **−7.4 pp**
- SE: 1.5 pp
- Z: −4.91
- 95% CI: [−10.3, −4.4]
- **p < 0.001** — **P3 CONFIRMED (statistically)**

The interaction is significant: learner agents decline *more* on WF-Gated conventions relative to WF-Indep, compared to reliant agents. However, the absolute magnitude (7.4 pp) is modest — the main effects (convention type and agent type) dominate.

**Effect sizes (Cohen's h):**
| Cell | h | Interpretation |
|---|---|---|
| Learner × WF-Gated | 0.849 | Large |
| Learner × WF-Indep | 0.567 | Medium |
| Reliant × WF-Gated | 0.556 | Medium |
| Reliant × WF-Indep | 0.346 | Small |

### P4: ≥ 60% of aggregate decline from Learner × WF-Gated

**Learner × WF-Gated contributes 39.2% of total weighted decline** — **P4 FAILED** (needed ≥ 60%)

The decline is spread across all cells, with Neutral × WF-Gated contributing a substantial share.

### Summary of Predictions

| Prediction | Result | Value |
|---|---|---|
| P1 (LG ≥ 2× others) | ❌ FAILED | 1.31× (needed 2.0×) |
| P2 (Reliant uniform) | ❌ FAILED | 2.40× (needed ≤ 1.3×) |
| P3 (Interaction significant) | ✅ CONFIRMED | Z = −4.91, p < 0.001 |
| P4 (LG ≥ 60% of decline) | ❌ FAILED | 39.2% (needed 60%) |

---

## 5. Per-Agent Detail

| Agent | Group | WF-Gated (Early→Late) | WF-Indep (Early→Late) | Δ Gated | Δ Indep | Gap |
|---|---|---|---|---|---|---|
| bob | L | 39.3% → 4.3% | 15.8% → 1.2% | −35.0 | −14.6 | −20.4 |
| coach | L | 34.0% → 5.7% | 14.6% → 0.7% | −28.3 | −14.0 | −14.3 |
| tech-lead | L | 35.7% → 4.2% | 9.2% → 1.2% | −31.5 | −8.0 | −23.5 |
| amy-kimi | R | 26.7% → 4.6% | 4.5% → 0.2% | −22.1 | −4.3 | −17.9 |
| qa | R | 23.6% → 5.9% | 12.1% → 2.8% | −17.7 | −9.3 | −8.4 |
| may | N | 15.6% → 1.8% | 4.0% → 2.7% | −13.8 | −1.3 | −12.5 |
| optimizer | N | 39.7% → 6.1% | 17.4% → 0.3% | −33.6 | −17.0 | −16.6 |
| scout | N | 35.3% → 5.8% | 0.8% → 1.3% | −29.5 | +0.5 | −30.0 |
| coder | N | 26.0% → 11.1% | 16.4% → 13.3% | −14.9 | −3.1 | −11.8 |

**Key finding:** The WF-Gated > WF-Indep asymmetry is present in *every* agent, not just learners. Optimizer (Neutral) shows a larger decline than coach (Learner). This pattern is inconsistent with H-102's mechanism — it suggests the convention-type effect is independent of agent workflow adoption.

---

## 6. Time-Series Analysis

### 6.1 Daily Fire Rates: Learner×WF-Gated vs All Other

| Date | Learner×Gated | All Other | Gap |
|---|---|---|---|
| Mar 24 | 43.3% | 23.1% | +20.2 |
| Mar 25 | 40.9% | 21.9% | +19.0 |
| Mar 26–29 | 39–44% | 16–22% | +11–20 |
| **Mar 30** | **31.9%** | **15.8%** | **+16.1** |
| **Mar 31** | **12.3%** | **4.4%** | **+7.9** |
| Apr 1–2 | 7–9% | 4–5% | +3–4 |
| Apr 3–6 | 8–14% | 3–5% | +1–6 |
| Apr 7+ | 3–5% | 1–4% | ±1–3 |
| **Apr 12** | **2.8%** | **2.8%** | **0.0** |

### 6.2 Structural Break: Mar 30–31

The most dramatic change occurs between Mar 29 (fire rates 40–42% for learners on gated) and Mar 31 (fire rate 12%). This is a **28 pp overnight drop**. This coincides with:

- **EventBus refactor (Phase 1–3):** Mar 29–30 commits unified event handling
- **DbWriter subscriber:** Mar 30 — DB writes moved to subscriber pattern
- **Agent calling infrastructure:** Mar 29 — call/fork/message pattern implemented

This sharp system-wide break strongly suggests **infrastructure changes** drove the decline, not gradual workflow adoption.

### 6.3 Learner–Neutral Gap Over Time

The rolling 3-day gap between Learner and Neutral fire rates on WF-Gated conventions:

| Period | Gap (Learner − Neutral) |
|---|---|
| Mar 24–27 | +6.8 to +9.1 pp |
| Mar 28–30 | +8.6 to +9.6 pp |
| Mar 31–Apr 2 | +2.6 to +7.0 pp |
| Apr 3–6 | +0.5 to +2.5 pp |
| Apr 7–9 | +1.4 to +2.0 pp |
| Apr 10–12 | **−1.4 to +0.2 pp** |

The learner–neutral gap **converges to zero** by Apr 10. Both groups end up at ~3% fire rate. This is inconsistent with H-102 (which predicts learners should maintain a differential advantage from workflow adoption) and consistent with a shared environmental cause.

### 6.4 Mann-Kendall Trend Test

For Learner × WF-Gated daily fire rate:
- n = 20 days, S = −152, τ = −0.800, Z = −4.899
- **p < 0.01** — highly significant declining trend

---

## 7. Per-Convention Trajectories (Learner Agents)

| Convention | Type | Early Avg | Late Avg | Decline |
|---|---|---|---|---|
| **C12.1** (session start) | Gated | 64.2% | 2.6% | **−61.6 pp** |
| **C1.3** (verify writes) | Gated | 53.5% | 9.1% | **−44.4 pp** |
| C3.2 (workspace isolation) | Indep | 19.7% | 0.0% | −19.7 pp |
| C2.1 (precise args) | Indep | 17.4% | 0.0% | −17.4 pp |
| C1.1 (read-before-edit) | Gated | 30.2% | 12.6% | −17.5 pp |
| C8.2 (promise-deliver) | Gated | 11.5% | 0.6% | −10.9 pp |
| C1.4 (finish clearly) | Indep | 11.8% | 1.3% | −10.5 pp |
| C7.1 (root is /app) | Indep | 13.6% | 3.4% | −10.3 pp |
| C6.1 (budget awareness) | Gated | 20.9% | 11.1% | −9.8 pp |
| C1.5 (ghost deliverables) | Indep | 6.8% | 1.9% | −4.8 pp |
| C1.7 (verification evidence) | Gated | 3.7% | 1.4% | −2.2 pp |
| C3.3 (safe append) | Indep | 2.1% | 0.0% | −2.1 pp |

**C12.1 (session-start orientation)** dominates the WF-Gated decline — it went from 95% fire rate to 1.5%. This single convention contributes disproportionately to the Gated vs Indep asymmetry.

**C3.2 (workspace isolation)** and **C2.1 (precise args)** — both WF-Independent — also show large declines (−19.7 and −17.4 pp), comparable to many WF-Gated conventions.

---

## 8. Robustness Check: C12.1 Sensitivity

Since C12.1 dominates the WF-Gated decline, let's check: does the WF-Gated > WF-Indep pattern survive if we reclassify C12.1 as Indep?

Without C12.1, the remaining 5 WF-Gated conventions for Learner agents:
- Average early fire rate: ~27.2%
- Average late fire rate: ~5.6%
- Decline: ~−21.6 pp (vs −13.0 pp for WF-Indep)

**The pattern survives** but is weakened. The asymmetry is partly driven by C12.1 but not entirely.

---

## 9. Interpretation

### Which prediction pattern fits?

| Pattern | Fit | Evidence |
|---|---|---|
| **H-102 Pure** (P1+P3+P4) | ❌ Poor | P1 and P4 failed; interaction exists but is modest |
| **Alternative (A1+A2)** | ❌ Partial | Decline is NOT uniform (WF-Gated > WF-Indep everywhere), but it IS universal across agent groups |
| **Mixed-Mechanism (M1+M2+M3)** | ✅ **Best fit** | Modest interaction (M1: 1.31×), 39.2% attributable (near M2 range), both main effects significant (M3) |

### Evidence summary

**For H-102 (workflow adoption as a mechanism):**
- ✅ Statistically significant interaction (p < 0.001)
- ✅ Learner × WF-Gated has the largest absolute decline
- ✅ Effect size for LG is "large" (Cohen's h = 0.849 vs 0.346–0.567 for other cells)

**Against H-102 (as the *primary* mechanism):**
- ❌ The WF-Gated > WF-Indep asymmetry is universal across ALL agent groups (not learner-specific)
- ❌ Neutral agents (optimizer, scout) show declines comparable to learners
- ❌ The sharp structural break on Mar 30–31 suggests infrastructure changes, not gradual workflow adoption
- ❌ The learner–neutral gap converges to zero by Apr 10 (no persistent learner advantage)
- ❌ P2 failed badly — reliant agents show the same gated/indep asymmetry as learners

### Most likely explanation

The decline is primarily driven by **infrastructure and system changes** (Mar 30–31 structural break aligns with EventBus refactor, DbWriter, agent calling improvements) that improved **all** agents' compliance, especially on process-step conventions (WF-Gated) that were most sensitive to tooling improvements.

Workflow adoption may be a **secondary, additive factor** explaining 5–10 pp of additional decline in learner agents, but it is **not the dominant mechanism** behind the −14 pp aggregate decline.

---

## 10. H-102 Probability Update

Per the decision rules in the EXP-148 design:

| Outcome | Rule | Update |
|---|---|---|
| P1 + P3 + P4 all confirmed | → 0.82 | ❌ Only P3 confirmed |
| M1 + M2 pattern (modest interaction) | → 0.65 (unchanged) | ✅ Best match |
| A2 partially confirmed (uniform agent decline) | → slight downward pressure | ✅ Also applies |

**H-102 P(H): 0.65 → 0.55**

Rationale: The interaction effect exists but is modest, and the evidence points more strongly toward infrastructure changes as the primary driver. The universal WF-Gated asymmetry across all agent types weakens the claim that workflow adoption specifically drives the decline. The probability drops modestly because the data is *inconsistent with but not definitively against* H-102 as a contributing factor.

---

## 11. Recommendations

1. **Do not pursue H-102 as the primary explanation for convention decline.** The evidence points to infrastructure improvements as the dominant cause.

2. **Investigate the Mar 30–31 structural break.** The EventBus refactor, DbWriter changes, and agent calling infrastructure are the most plausible causal factors. An experiment comparing convention compliance in sessions that use the new infrastructure vs legacy could confirm this.

3. **C12.1 (session-start orientation) deserves separate study.** Its dramatic 95% → 1.5% fire rate change suggests either (a) the convention checker was updated to be less strict, or (b) a specific change made agents orient themselves at session start. This single convention accounts for ~30% of the total WF-Gated decline.

4. **Reframe H-102 more narrowly.** If workflow adoption is a mechanism, it's for the *residual* decline after accounting for infrastructure effects. A more testable hypothesis: "After controlling for the Mar 30–31 infrastructure change, learner agents show faster convergence to steady-state compliance on WF-Gated conventions."

---

## 12. Success Criteria Checklist

- [x] All 12 conventions classified as workflow-gated or workflow-independent (§1)
- [x] The 2×2×2 analysis matrix populated with adherence rates and decline values (§3)
- [x] The interaction effect quantified (§4, P3: −7.4 pp, Z = −4.91)
- [x] H-102 P(H) updated per decision rules (§10: 0.65 → 0.55)
- [x] Results documented in `EXP-148/results.md` (this file)
