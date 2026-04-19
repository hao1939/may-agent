# CR#344 — The Calibration Bridge: From Raw Runtime Signals to Actionable Verification

**Type**: Cross-reference synthesis (DD#774 GLEAN × CR#343 Monitoring Turn × DD#777 Co-Sight)  
**Date**: 2026-04-19 (Sunday synthesis)  
**Rating**: ★★★★½  
**Scope**: Gap between CR#343's monitoring architecture layers and the verification convergence in CR#342

---

## The Gap

CR#343 established a 5-layer monitoring architecture (L0 static eval → L1 structural enforcement → L2 behavioral signals → L3 continuous feedback loop → L4 meta-evaluation). CR#342 catalogued five verification systems converging on "evidence architecture." But neither synthesis addresses the **critical transition from L2 to L3**: how do raw behavioral signals (bi-predictability scores, hidden-state probes, guideline alignment ratings) become *calibrated probabilities* that drive actionable decisions?

Without calibration, Layer 2 signals are noisy numbers. With calibration, they become decision-ready confidence scores. **GLEAN (DD#774) provides the missing mathematical bridge.**

---

## The Calibration Bridge Pattern

### Raw Signal → Calibrated Probability → Decision

```
L2 Raw Signals                    Calibration Bridge (NEW)           L3 Decisions
─────────────────                 ─────────────────────              ──────────────
DD#775 bi-predictability P    ──┐                                   
DD#770 hidden-state probes    ──┤── DD#774 GLEAN Bayesian    ──→    Trigger re-verification?
DD#781 tool-type confidence   ──┤   logistic regression             Escalate to human?
DD#777 Co-Sight conflict      ──┘   over accumulated features       Allocate more compute?
     hotspots                                                       Accept/reject output?
```

### Why GLEAN's Mechanism Fits

GLEAN (DD#774) does three things that bridge L2→L3:

1. **Feature accumulation along trajectory**: Doesn't score a single snapshot — accumulates guideline-alignment features step-by-step. This maps to monitoring agents *over time*, not at a single checkpoint.

2. **Bayesian calibration**: Converts accumulated feature vectors into calibrated probabilities via logistic regression. The 50% Brier score reduction (vs. baselines) means these probabilities *mean what they say* — a 0.8 confidence is right 80% of the time.

3. **Active verification trigger**: Uses calibrated uncertainty to decide *when to spend more verification compute*. Low confidence → collect more evidence. High confidence → proceed. This is exactly the L3 decision mechanism CR#343 left unspecified.

### Co-Sight (DD#777) as Complementary Allocator

Where GLEAN calibrates *confidence*, Co-Sight calibrates *where to look*:

- **GLEAN**: "How confident should we be in this output?" → calibrated probability
- **Co-Sight CAMV**: "Where do agents disagree?" → conflict-directed verification allocation

Together they answer both questions a monitoring system needs: *how much* to verify (GLEAN's calibrated uncertainty) and *what* to verify (Co-Sight's conflict hotspots).

---

## Concrete Integration with CR#343 Monitoring Stack

### Updated Architecture

```
Layer 4: META-EVALUATION       — DD#780: Evaluate your evaluation system
   ↑
Layer 3: DECISION + LOOP       — DD#778 EDDOps + GLEAN active trigger
   ↑                              Calibrated confidence drives: escalate / accept / re-verify
Layer 2.5: CALIBRATION BRIDGE  — DD#774 GLEAN Bayesian accumulation     ← NEW LAYER
   ↑                              DD#777 Co-Sight conflict allocation
Layer 2: BEHAVIORAL SIGNALS    — DD#770 probes, DD#775 bi-predictability
   ↑
Layer 1: STRUCTURAL ENFORCE    — DD#763 Parallax, DD#766 Sentinel
   ↑
Layer 0: STATIC EVALUATION     — Benchmarks, test suites
```

The insertion of Layer 2.5 resolves a practical problem: CR#343's original L2→L3 jump assumed behavioral signals directly drive decisions. But DD#775's bi-predictability score P is an information-theoretic measure — it's not inherently a probability of correctness. GLEAN's Bayesian calibration converts such scores into decision-ready probabilities.

---

## Cross-Cutting Predictions

**P-344a (GLEAN + Bi-Predictability)**: Using DD#775's bi-predictability P as an input feature to DD#774's GLEAN calibration framework should yield better-calibrated verification than either alone. P provides the *detection* signal (structural coupling/uncoupling); GLEAN provides the *calibration* mechanism (what does a given P score mean for correctness probability?). Neither paper tests this combination.

**P-344b (Conflict-Directed Calibration)**: Co-Sight's conflict hotspots (DD#777) should improve GLEAN's active verification efficiency by narrowing the evidence search space. Instead of GLEAN expanding guideline coverage uniformly under uncertainty, direct expansion toward conflict zones. Predicted: 30-50% reduction in active verification compute for equivalent calibration quality.

**P-344c (EXP-101 Retrospective)**: EXP-101's HVR AUROC 0.535 failure is explained by missing calibration. HVR used raw self-reported confidence (uncalibrated L2 signal) directly for decisions (L3). The GLEAN pattern predicts: accumulate multiple verification features (not just one HVR score) + apply Bayesian calibration → significantly higher discrimination. The DD#781 confidence dichotomy (tool-type matters) suggests HVR's single-number approach was doomed — calibration must be context-aware.

---

## Actionable Connections

| Finding | Source | Application |
|---------|--------|-------------|
| Bayesian feature accumulation over trajectory | DD#774 GLEAN | Replace single-point HVR with accumulated multi-signal calibration |
| Conflict-directed verification allocation | DD#777 Co-Sight | When Scout and Bob disagree on a DD rating, that's a CAMV conflict hotspot — worth extra verification |
| Calibration requires multiple heterogeneous signals | DD#781 + DD#774 | Don't rely on one signal type; combine bi-predictability + tool-type confidence + guideline alignment |
| Active verification = uncertainty-driven compute allocation | DD#774 + DD#702 DOVA | Merge GLEAN's active trigger with DOVA's budget allocation for cost-optimal verification |

---

## Relationship to Prior CRs

- **CR#343** (Monitoring Turn): This CR adds the missing calibration layer (L2.5) between behavioral signals and decisions
- **CR#342** (Verification Convergence): This CR shows how the five verification systems combine — GLEAN calibrates, Co-Sight allocates, SmartSnap seeks, Weak-Strong optimizes cost, Explanatory Equilibrium resolves asymmetry
- **CR#340** (Enforcement Architecture): Calibrated monitoring is the complement to structural enforcement — enforcement prevents harm, calibrated monitoring detects when enforcement isn't enough
- **CR#324** (Signal Calibration Gap): **This CR closes the gap.** DD#774 GLEAN provides the calibration mechanism CR#324 identified as missing.

---

*CR#344 produced 2026-04-19 (Sunday synthesis). Bridges CR#343 monitoring architecture with DD#774 GLEAN calibration and DD#777 Co-Sight conflict allocation. Closes CR#324 signal calibration gap.*
