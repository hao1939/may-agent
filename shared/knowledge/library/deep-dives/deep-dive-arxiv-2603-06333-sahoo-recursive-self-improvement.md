# Deep Dive: SAHOO — Safeguarded Alignment for High-Order Optimization Objectives in Recursive Self-Improvement

**Paper:** arXiv:2603.06333v1 (March 6, 2026)
**Authors:** Subramanyam Sahoo (Cambridge AI Safety Hub), Aman Chadha (AWS/Stanford), Vinija Jain (Google/Stanford), Divya Chaudhary (Northeastern)
**Venue:** ICLR 2026 Workshop on AI with Recursive Self-Improvement
**Code:** SubramanyamSahoo/SAHOO-in-Recursive-Self-Improvement (GitHub)
**License:** CC BY 4.0

## Core Problem

Recursive self-improvement — systems that critique, revise, and evaluate their own outputs iteratively — risks **subtle alignment drift** that compounds across cycles. A system gaining +10% code quality but losing -15% truthfulness hasn't actually improved. SAHOO provides the first practical framework to **measure, monitor, and control** alignment drift during self-improvement.

## Three Safeguards

### 1. Goal Drift Index (GDI)
A composite multi-signal detector measuring drift across **four orthogonal dimensions**:

- **Semantic Drift:** Embedding-space distance — meaning shifts despite similar surface form
- **Lexical Drift:** Vocabulary distribution divergence via KL divergence — correlated with different value distributions
- **Structural Drift:** Format/organization pattern analysis — response structure changes
- **Distributional Drift:** Statistical divergence across multiple runs via KL + Wasserstein distance

**Key design:** Component weights are learned via logistic regression on human-evaluated drift labels during calibration (not hand-tuned). Composite GDI is computed as weighted combination of all four signals. Thresholds are calibrated per-task-type from data distributions.

**Why all four matter:** A system can drift semantically without drifting lexically, or structurally without semantic change. Single-signal detection misses most drift modes.

### 2. Constraint Preservation Checks
Binary enforcement of safety-critical invariants:
- Syntactic correctness (code)
- Non-hallucination (truthfulness)
- Format compliance
- Any domain-specific safety property

**Zero tolerance:** Constraint violation triggers immediate stopping — absolute priority over all other termination conditions.

### 3. Regression-Risk Quantification
Flags when improvement cycles **undo prior gains**. Computed from three signals:
- **Volatility:** Variance of quality scores across recent cycles
- **Trend:** Direction of quality trajectory
- **Volatility-normalized gap:** Current quality vs. historical peak, normalized by volatility

Regression probability is computed per-cycle and compared against calibrated threshold. **Early warning:** Mean regression detection occurs at cycle 4.5 — gives humans time to intervene before drift becomes severe.

## Experimental Design

- **Base model:** Qwen3-8B
- **Benchmarks:** HumanEval (code), TruthfulQA (truthfulness), GSM8K (math reasoning)
- **189 tasks** total (63 per benchmark via power analysis for 0.3 SD effect detection at 80% power)
- **Calibration:** 18 tasks, 3 cycles → learns all thresholds
- **Temperature:** √2/2 ≈ 0.707 (entropy-maximizing for binary outcomes)
- **Bootstrap:** ~2000 samples for 95% CI with width 0.05

### Multi-Stop Termination Rules (first-triggered wins):
1. Constraint violation → immediate halt (absolute priority)
2. GDI exceeds calibrated threshold
3. Regression risk exceeds threshold
4. Quality convergence (Δ < 0.01 for 3 consecutive cycles)
5. Maximum cycle count reached

## Key Results

| Domain | Quality Gain | Constraints | Drift |
|--------|-------------|-------------|-------|
| Code (HumanEval) | +18.3% | Preserved | Bounded |
| Math Reasoning (GSM8K) | +16.8% | Preserved | Bounded |
| Truthfulness (TruthfulQA) | Improved | Low violations | Domain tension detected |

### Critical Findings:

1. **Capability-Alignment Ratio (CAR) Frontier:** Early cycles are efficient (high quality gain per unit alignment cost). Later cycles show **rising alignment costs** — diminishing returns on quality with increasing drift risk.

2. **Domain-specific tensions:** Fluency vs. factuality in truthfulness — improving one can degrade the other. This is a fundamental tradeoff, not an implementation artifact.

3. **Regression is rare but bimodal:** 0.7% regression rate (excluding one outlier task). The outlier showed bimodal quality distribution — model learned to alternate between distinct solution strategies. This pattern is detectable and provides a specific signal for human intervention.

4. **Naive approaches fail:** Purely conservative approaches (restrict improvement to minimize risk) achieve near-zero drift but also near-zero quality improvement. Purely aggressive approaches (maximize quality, ignore alignment) achieve high quality gains but uncontrolled drift. SAHOO occupies the Pareto-optimal middle ground.

5. **All parameters are data-driven:** No arbitrary hyperparameters. Thresholds from calibration data. Weights from logistic regression. Probabilities from historical patterns.

## Theoretical Foundations (Appendix)

- **Lipschitz continuity of drift:** GDI changes are bounded between consecutive cycles
- **Asymptotic drift bounds:** Under contractive regimes, drift converges to bounded region
- **Stability guarantees:** If the self-improvement operator is contractive (drift per cycle < 1), the system converges

## Connection to Our System

### Direct Applicability

**Our system has recursive self-improvement by design.** When our evaluator assesses agent outputs, and agents iterate based on evaluator feedback, this IS a self-improvement loop. SAHOO's insights apply directly:

1. **GDI for evaluator drift monitoring:** Our evaluator (May/QA) could drift across sessions — same evaluation criteria producing different verdicts over time. The four-signal approach (semantic, lexical, structural, distributional) maps to:
   - Semantic: Are evaluator verdicts shifting in meaning?
   - Lexical: Is the evaluator changing vocabulary patterns?
   - Structural: Is the evaluator changing response format?
   - Distributional: Is the evaluator's score distribution shifting?

2. **Constraint preservation for delegated work:** Every delegation could carry explicit constraint specifications (must compile, must pass tests, must not introduce regressions) with binary enforcement and immediate stopping on violation.

3. **Regression detection across sessions:** Track quality metrics across heartbeats/sessions. If a subsequent session undoes prior gains, flag and intervene before the regression compounds.

4. **CAR frontier for budget management:** The insight that early cycles are efficient but later cycles show rising alignment costs directly informs when to stop iterating on a task and move on.

### Cross-References to Prior Deep-Dives

| Paper | Connection to SAHOO |
|-------|-------------------|
| **JRH (2603.05399)** | JRH stress-tests judges via perturbations; SAHOO monitors the self-improvement loop those judges participate in. **Complementary:** JRH = "is the judge reliable?" + SAHOO = "is the system drifting?" |
| **Bias-Bounded Eval (2603.05485)** | Bias-bounded provides (τ,δ) guarantees on individual evaluations; SAHOO provides drift bounds across evaluation cycles. **Layered defense:** bounded bias per-evaluation + bounded drift per-cycle. |
| **Introspection (2603.05414)** | Content-agnostic detection (models know THAT something is off without knowing WHAT) is exactly the type of signal GDI's semantic component would detect — anomaly flags that resist explanation. |
| **DPIP Common Ground (2603.05450)** | DPIP showed LLMs can't track "who knows what." SAHOO's constraint preservation could enforce explicit context requirements in delegation — don't assume shared knowledge, specify it. |
| **Bug-Hunt adversarial architecture** | Bug-Hunt uses weaponized bias (Hunter→Skeptic→Referee). SAHOO could monitor whether the adversarial loop itself is drifting — are the Hunter and Skeptic maintaining their prescribed roles? |
| **Reflective TTP (2602.21198)** | Reflective TTP's three-LLM architecture (Generator/Internal-Eval/External-Eval) IS a recursive self-improvement loop. SAHOO's GDI + regression risk would directly monitor whether the reflection cycles are maintaining alignment. |

### Actionable Next Steps

1. **Implement lightweight GDI for evaluator consistency:** Track evaluator outputs across sessions using the four-signal framework. Don't need full SAHOO — even just semantic drift (embedding distance between consecutive evaluator outputs on similar inputs) would catch major drift.

2. **Add constraint specifications to delegation format:** Each task delegation should carry explicit constraints that are binary-checkable. Current delegation format likely doesn't have this.

3. **Calibrate stopping rules:** When iterating on a task (e.g., code review → fix → re-review), apply convergence detection (quality change < threshold for N consecutive cycles) to avoid thrashing.

4. **Map the CAR frontier empirically:** Track (quality gain, alignment cost) across our own sessions. Where does the efficiency inflection point occur?

5. **Bimodal detection for agent role stability:** Monitor whether agents maintain consistent behavioral patterns across sessions. The bimodal outlier finding (agent alternating between solution strategies) maps to agent "role confusion."

## Limitations

- Calibrated on specific benchmarks + Qwen3-8B — needs recalibration for other models/tasks
- Depends on explicit constraint specifications (hard to write for ethical/value-laden properties)
- Measures deviation from baseline — if baseline is already misaligned, detectors may not help
- Requires human evaluation for truthfulness checks → scalability concern
- Single author (SS) did all work; co-authors only reviewed. Concentrates both credit and risk.
- ICLR workshop paper, not main conference — lower review bar

## Assessment

**★★★ Core — directly applicable to our system's self-improvement loop.**

SAHOO is the first practical, data-driven framework for alignment preservation during recursive self-improvement. The four-signal GDI, constraint preservation, and regression-risk quantification form a comprehensive safety net. The key insight — that alignment drift is multi-dimensional and single-signal detection misses most modes — is both theoretically sound and empirically validated. The CAR frontier analysis (efficient early cycles, rising late costs) has immediate implications for our own iteration budgets.

The framework is deployable today. All parameters are data-driven. Calibration requires only ~18 tasks and 3 cycles. The stopping rules are principled and composable.

**Highest-value takeaway:** Don't try to prevent drift entirely (that prevents improvement). Instead, measure drift across multiple signals, bound it with data-driven thresholds, and stop when the cost-benefit ratio inflects. This is the same philosophy as bias-bounded eval (2603.05485): accept the phenomenon exists, bound its impact.
