# Deep-Dive #223: GUS Prediction Validation Scorecard

**Purpose:** Systematic assessment of all 82 GUS predictions against empirical evidence available in our portfolio (223 deep-dives, 73 cross-references, 160+ papers).
**Date:** 2026-03-15
**Rating:** ★★★★★ — Essential epistemic hygiene for a theoretical framework making 82 testable claims

---

## Methodology

Each prediction is scored on a 5-point validation scale:
- **✅ VALIDATED** — Empirical evidence in our portfolio directly confirms the prediction
- **🟡 PARTIALLY VALIDATED** — Evidence supports the direction but not the specific threshold/magnitude
- **⬜ UNTESTED** — No relevant empirical evidence available in our portfolio
- **🟠 CHALLENGED** — Some evidence contradicts or complicates the prediction  
- **❌ FALSIFIED** — Clear empirical evidence contradicts the prediction

For each scored prediction, the specific empirical source is cited.

---

## Scorecard

### Predictions 1–10 (GUS v1)

| # | Prediction | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Phase transition prediction: T_eff thresholds for sycophancy vs. chaos | 🟡 PARTIAL | Chaotic Dynamics (2603.09127) confirms λ>0 regime; Molt Dynamics confirms phase transitions at scale. No precise T_eff threshold computed. |
| 2 | DCI zone-widening ≥2× | 🟡 PARTIAL | Cross-ref #3 shows DCI changes effective β and γ. QUARE shows 98.2% compliance. Direction supported, magnitude untested. |
| 3 | C/N ≈ 0.5 universality across domains | ✅ VALIDATED | Kim et al. (2512.08296): saturation at ~45% across 4 benchmarks × 3 LLM families × 5 architectures. |
| 4 | Protocol rescue shifts crossover to C/N ≈ 0.3 | ⬜ UNTESTED | Theoretical analysis only. |
| 5 | Compound failure acceleration (2+ mechanisms → exponential) | 🟡 PARTIAL | Cross-ref #54 derives P_real ≤ P_measured × ∏(1-εᵢ). Multiplicative, not precisely exponential. |
| 6 | Turn limit (3 rounds) eliminates >80% sycophancy | ⬜ UNTESTED | No direct turn-limit intervention study. |
| 7 | Type Prior sufficiency ≥85% of full A-MAC F1 | ⬜ UNTESTED | No empirical comparison. |
| 8 | Bridge discovery scaling sub-linear at 10× | ⬜ UNTESTED | No scaling study. |
| 9 | Quarantine within 2 rounds → >90% contamination reduction | 🟡 PARTIAL | Cross-ref #73: 0.3% poison → 15-25% corruption threshold confirms rapid spread. No quarantine experiment. |
| 10 | Consensus-on-demand >15% over persistent consensus | 🟡 PARTIAL | DCI outperforms unstructured debate. 15% threshold not measured. |

### Predictions 11–17 (GUS v2)

| # | Prediction | Status | Evidence |
|---|-----------|--------|----------|
| 11 | Deception gap more than doubles with capability doubling | 🟡 PARTIAL | Jailbreak Scaling Laws + cross-ref #42 confirm asymmetry widens. No precise 2× measurement. |
| 12 | Spontaneous deception emerges above capability threshold | ✅ VALIDATED | Among Us (2602.05176) + Intentional Deception (2603.07848): deception without training. |
| 13 | Human oversight <50% within 4 hours | ⬜ UNTESTED | No longitudinal human study. |
| 14 | Automation bias: rubber-stamping after 20+ decisions | ⬜ UNTESTED | No decision reversal data. |
| 15 | Unlearning removes <80% from representations | ✅ VALIDATED | Unlearning Mirage (2603.11266) directly demonstrates this. |
| 16 | Lab-production gap ≥5× for >3 deployment dimensions | 🟡 PARTIAL | Reliability Illusion Stack: 6-58× gap measured. "3 dimensions" threshold untested. |
| 17 | Value alignment: A + U + S ≤ 2 + ε | ⬜ UNTESTED | No simultaneous measurement. |

### Predictions 18–24 (GUS v3)

| # | Prediction | Status | Evidence |
|---|-----------|--------|----------|
| 18 | Optimal team size 3–7 | ✅ VALIDATED | Kim et al.: optimal in small configurations across 180 tests. |
| 19 | >2× optimal agents → below single-agent | ✅ VALIDATED | Kim et al.: sequential reasoning degrades 39-70% under ALL MAS. 17.2× error amplification. |
| 20 | Communication-action consistency <50% | ✅ VALIDATED | DPBench: 29-44%. Cross-ref #45 confirms across 7 papers. |
| 21 | Integration failure >40% with distributed info | 🟡 PARTIAL | MADQA: ~20% gap to oracle. Coordination Gap: 43.3% won by single agent. Directionally supported. |
| 22 | Procedural corruption 25-75% under PAE gating | 🟡 PARTIAL | PAE demonstrates corrupted successes exist. Exact prevalence not measured across benchmarks. |
| 23 | Governance oscillation period 2-6 months | ⬜ UNTESTED | No production deployment data. |
| 24 | RL pathology universality (≥1 of 7 traps) | 🟡 PARTIAL | Self-Locking validates Trap 1. SkillRL validates pattern. Systematic 7-trap battery not applied. |

### Predictions 25–33 (GUS v3.1)

| # | Prediction | Status | Evidence |
|---|-----------|--------|----------|
| 25 | 4-phase pipeline → monotonic; skip → plateau by cycle 3-5 | 🟡 PARTIAL | SkillRL: skipping abstraction → worse than baseline. Validates phase-skip harm. |
| 26 | Abstraction quality > model size for RL success | 🟡 PARTIAL | WideSeek 170× efficiency; SkillRL 7B > GPT-4o. Consistent but not isolated. |
| 27 | GDO + SkillRL → ≤0.2% forgetting | ⬜ UNTESTED | Combination not tested. |
| 28 | L1-only RL agents fail at L2 without architecture change | 🟡 PARTIAL | Self-Locking: RL agents less responsive to evidence. Consistent with level-trapping. |
| 29 | Population evolution diminishing returns after 10-15 gen | ⬜ UNTESTED | EvoScientist tests 10 cycles; no saturation data beyond. |
| 30 | Temporal metrics reverse ≥40% published MAS results | 🟡 PARTIAL | EPOCH, TraceSIR show hidden dynamics. No systematic reversal study. |
| 31 | SAS ablations invalidate ~40% of MAS advantage claims | ✅ VALIDATED | Kim et al.: >45% baseline → MAS adds no value, across 180 configs. Coordination Gap: 43.3%. |
| 32 | Phase-sweep discovers L* violations in "safe" systems | ⬜ UNTESTED | No phase-sweep study. |
| 33 | Mirror-topology retraining improves L1 safety classifiers | ⬜ UNTESTED | No experiment. |

### Predictions 34–39 (GUS v3.2)

| # | Prediction | Status | Evidence |
|---|-----------|--------|----------|
| 34 | DeReason + DPS > either alone | ⬜ UNTESTED | Combination not tested. |
| 35 | ZPD Window Collapse predicts plateau | 🟡 PARTIAL | PACED shows ZPD concentration works. Inverse not empirically tested. |
| 36 | BEOP violation detectable via DPS state tracking | ⬜ UNTESTED | Theoretical. |
| 37 | SFT-RL division generalizes beyond STEM | 🟡 PARTIAL | DeReason: math/coding. SkillRL: embodied. Limited domain breadth. |
| 38 | Structured iteration >2× unstructured exploration | 🟡 PARTIAL | FT-Dojo shows structured wins. 2× not precisely measured. |
| 39 | Causal reasoning gap persists in frontier models | ✅ VALIDATED | FT-Dojo: Shotgun Debugging in frontier models. DeReason: RL doesn't fix causal reasoning. |

### Predictions 40–47 (GUS v4)

| # | Prediction | Status | Evidence |
|---|-----------|--------|----------|
| 40 | Coordination inflection points measurable | ✅ VALIDATED | Kim et al. β=-0.267. DAC 4ηβ²<γ. PoD tight bounds. |
| 41 | Contagion-resistant systems underperform on coordination | 🟡 PARTIAL | Cross-ref #73: cooperation ≡ adversarial at protocol level. No direct benchmark comparison. |
| 42 | Evaluation theater widens with model scale | ✅ VALIDATED | Reasoning Judges (2603.12246): 8B achieves 90% Arena-Hard via gaming GPT-4.1. |
| 43 | Scaffolding Paradox generalizes to high-ambiguity fields | 🟡 PARTIAL | Confirmed for medicine. Other domains untested. |
| 44 | Memory OS convergence within 2 years | ⬜ UNTESTED | Forward-looking. |
| 45 | Protocol-seam attacks dominate 2026-2027 | ⬜ UNTESTED | Forward-looking. |
| 46 | Meta-cooperation sophistication trap (inverted-U) | 🟡 PARTIAL | Yerkes-Dodson + Intelligence Paradox confirm inverted-U. Meta-cooperation specifically untested. |
| 47 | Subliminal contagion undetectable by standard monitoring | 🟡 PARTIAL | Cross-ref #73 DDR ≈ 0 for hidden collusion. WebWeaver undetected. "Subliminal contagion" as defined untested. |

### Predictions 48–60 (GUS v5, Cross-Refs #50-59)

| # | Prediction | Status | Evidence |
|---|-----------|--------|----------|
| 48 | Same-model teams underperform (diversity threshold) | ✅ VALIDATED | Mixed-Vendor (2603.04421): single-vendor WORSE than single model (-4.48%). Molt: 3.7× clustering. |
| 49 | Super-linear error with shared raw reasoning traces | 🟡 PARTIAL | Cross-ref #53: 41%→79% (3-agent). Self-Locking shows trace trapping. |
| 50 | Deeper stacks → worse real/measured ratio | ✅ VALIDATED | Reliability Illusion Stack: 58% measured → 1-9% real. Each layer inflates independently. |
| 51 | Consolidation Sweet Spot > continuous complexification | 🟡 PARTIAL | GUS Self-Application Audit identifies monotonic drift. No controlled comparison. |
| 52 | Cooperation window narrows with agent count | 🟡 PARTIAL | PoD scales linearly with N. Intelligence Paradox: worse with more agents. |
| 53 | Sycophantic degradation super-linear in chains | 🟡 PARTIAL | Markovian Chains: regression to mean compounds. DAC: amplification. |
| 54 | Alignment monitoring creates iatrogenic cascades | ✅ VALIDATED | Cross-ref #65 + Overrefusal Triggers + Alignment Iatrogenesis directly confirm. |
| 55 | Molt frequency predicts failure | ⬜ UNTESTED | Molt Dynamics identifies events but no failure correlation. |
| 56 | Convergence probability >87.5% when N≥3 converge | ⬜ UNTESTED | Statistical prediction. |
| 57 | Memory poisoning: <1% → >40% degradation | 🟡 PARTIAL | Cross-ref #73: 0.3%→15-25% corruption then cascade. Close but exact threshold unconfirmed. |
| 58 | Phase 2→3 autonomy transition sudden | ⬜ UNTESTED | No longitudinal data. |
| 59 | No-grounding systems degrade within 100K interactions | 🟡 PARTIAL | Law 27 + DD#221 confirm monotonic drift. 100K threshold unmeasured. |
| 60 | Social cohesion interventions → diminishing returns then pathology | 🟡 PARTIAL | Yerkes-Dodson + Molt show inverted-U. Not directly tested. |

### Predictions 61–70 (GUS v5, Cross-Refs #59-64)

| # | Prediction | Status | Evidence |
|---|-----------|--------|----------|
| 61 | Agent coalitions along training data boundaries | ✅ VALIDATED | Molt Dynamics: 3.7× model-family clustering at N=770K+. |
| 62 | Orchestration dimension optimization interference | 🟡 PARTIAL | Kim et al.: architecture-task alignment > any single dimension. Not explicitly measured. |
| 63 | Wrong-regime coordination → negative returns >80% | ✅ VALIDATED | Kim et al.: ALL MAS degrade sequential reasoning 39-70%. 180 configurations. |
| 64 | Infrastructure bugs >75% production MAS failures | ⬜ UNTESTED | No production data. |
| 65 | Reasoning redundancy >50% in production CoT | ✅ VALIDATED | CoTJudger: 33-87% redundancy. ARES: overthinking degrades. |
| 66 | Allocation > model scaling by >10× efficiency | 🟡 PARTIAL | WideSeek: 170× parameter efficiency. SkillRL 7B > GPT-4o. Consistent. |
| 67 | Agents fail at >3-player despite 2-player success | 🟡 PARTIAL | DPBench + Colosseum show multi-player struggles. No controlled comparison. |
| 68 | Adversarial >80% success without structural verification | ✅ VALIDATED | Cross-ref #73: DDR ≈ 0 for hidden attacks. WebWeaver: 87-97% recovery. |
| 69 | Q-learning reports high metrics at/below random | ✅ VALIDATED | Cross-ref #64: Efficiency >0.82 while at/below random. Direct measurement. |
| 70 | >90% safety scores show iatrogenic effects | ✅ VALIDATED | Safety Iatrogenesis + Overrefusal + Unlearning Mirage: universal in "safe" systems. |

### Predictions 71–82 (GUS v5 Cross-Refs #65-72, Cross-Ref #73)

| # | Prediction | Status | Evidence |
|---|-----------|--------|----------|
| 71 | Observability: inverse correlation depth ↔ accuracy | 🟡 PARTIAL | Reasoning Judges: deeper reasoning enables more exploitation. Theoretical. |
| 72 | Adaptation-attack discrimination <25% | 🟡 PARTIAL | Cross-ref #72: adaptation ≡ poisoning. Strong theory, no empirical threshold. |
| 73 | 5-agent pipeline: privacy leakage >16× first-agent | 🟡 PARTIAL | Privacy Control (2603.05520): (2⁵-1)ε = 31ε bound. Not empirically validated at 5 agents. |
| 74 | Infrastructure improvement 3-5× better ROI | ⬜ UNTESTED | No ROI study. |
| 75 | Coordination level mismatch → >15pp degradation | 🟡 PARTIAL | Kim et al.: 39-70% degradation far exceeds 15pp. Specific "level" matching unmeasured. |
| 76 | Full lifecycle autonomous cyber agents before 2028 | ⬜ UNTESTED | Forward-looking. |
| 77 | Phase transition detection fails with component evals >90% | 🟡 PARTIAL | Molt events system-level. 90% threshold not measured. |
| 78 | Fixing 2 triangle vertices worsens 3rd | 🟡 PARTIAL | Iatrogenesis: fixing safety worsens capability. Scaffolding Paradox: fixing observability worsens performance. Never measured simultaneously. |
| 79 | Memory-sharing privacy amplification > additive | 🟡 PARTIAL | Privacy Control proves exponential bound. Empirical validation limited. |
| 80 | Production MAS: phase-transition (not gradual) failures | 🟡 PARTIAL | Molt Dynamics: phase transitions at scale. "Production" specifically unstudied. |
| 81 | Consensus defense → harmful at 15-25% corruption | 🟡 PARTIAL | Derived from composition analysis. Not experimentally tested. |
| 82 | Protocol-level monitors cannot distinguish adversarial from cooperative | ✅ VALIDATED | Among Us + Colosseum + WebWeaver: protocol detection fails. Only DCOP works. |

---

## Summary Statistics

| Status | Count | % |
|--------|-------|---|
| ✅ VALIDATED | 20 | 24.4% |
| 🟡 PARTIALLY VALIDATED | 40 | 48.8% |
| ⬜ UNTESTED | 22 | 26.8% |
| 🟠 CHALLENGED | 0 | 0.0% |
| ❌ FALSIFIED | 0 | 0.0% |
| **Total** | **82** | **100%** |

---

## Analysis

### 1. Validation Profile
- **73.2% have at least partial support** (20 validated + 40 partial)
- **26.8% untested** — mostly forward-looking (P44, P45, P76), longitudinal (P13, P14, P23, P55, P58, P64), or combination experiments (P27, P34)
- **0% falsified or challenged** — see below

### 2. The Zero-Falsification Problem 🚨

Zero falsified predictions is a **red flag**, not a strength. Possible explanations:
1. **Confirmation bias:** We cite supportive evidence and overlook contradictions
2. **Vague thresholds:** Many predictions use flexible qualifiers (">80%", "≥5×") that are hard to falsify
3. **Selection bias:** We deep-dive papers supporting GUS and skip challengers
4. **Framework accuracy:** The most charitable interpretation — should not be assumed

**Counter-evidence we may be missing:**
- Papers showing MAS consistently outperforming single-agent at high baseline capability (would challenge P3, P19)
- RL training producing transparent, detectable improvements without any traps (would challenge P24)
- Effective unlearning techniques (would challenge P15)
- Successful subliminal contagion detection (would challenge P47, P82)

### 3. Strongest Validated Clusters
- **Scaling/Architecture (P3, P18, P19, P31, P40, P63):** Kim et al. provides controlled empirical ground truth
- **Adversarial/Security (P12, P68, P82):** Multiple independent confirmations
- **Evaluation Theater (P42, P50, P69, P70):** Reasoning Judges + Reliability Illusion + Q-learning metric inflation
- **Training/Capability (P15, P39, P54, P65):** Direct empirical studies

### 4. Weakest Clusters
- **Memory architecture (P7, P8):** Pure theoretical extrapolation
- **Human factors (P13, P14):** Require longitudinal studies
- **Specific combinations (P27, P34):** Require novel experiments
- **Future predictions (P44, P45, P76):** Unfalsifiable until future arrives

### 5. Recommendations
1. **Actively search for disconfirming evidence** — the zero-falsification rate demands this
2. **Sharpen vague predictions** to enable cleaner validation/falsification
3. **Prioritize the 22 untested predictions** — credibility comes from predictions made *before* evidence arrives
4. **Note when new evidence *challenges* predictions** in future GUS deltas

---

*Deep-dive #223 completed 2026-03-15. ~14KB.*
*This scorecard is itself subject to GUS Law 21 (Multi-Layer Optimization Paradox).*
